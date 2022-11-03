import json
import os
import shutil
from datetime import datetime
from sqlalchemy import create_engine, Column, String, Integer, DateTime, Boolean, ForeignKey, desc
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship, backref
from .config import Config
from .errors import SpecError
from .hub import encode_username, spawner_info, user_spawners
from .zip import sizeof_fmt

Base = declarative_base()


class Project(Base):
    """ORM model representing a personal project"""
    __tablename__ = 'myprojects'

    id = Column(Integer, primary_key=True)
    owner = Column(String(255))
    dir = Column(String(255))
    image = Column(String(255))

    name = Column(String(255))
    description = Column(String(511), default='')
    author = Column(String(255), default='')
    quality = Column(String(255), default='')
    citation = Column(String(511), default='')
    tags = Column(String(255), default='')

    def __init__(self, spec=None):
        super(Project, self).__init__()                                     # Call the superclass constructor
        if spec is None: return                                             # If no spec, nothing left to do

        # If a spec was given, parse it and instantiate this project with the data
        try:
            if isinstance(spec, str): spec = json.loads(spec)               # Parse the JSON, if necessary
            for key in Project.__dict__:                                    # Assign attributes from the json
                if key in spec:
                    if isinstance(spec[key], str): setattr(self, key, spec[key].strip())
                    else: setattr(self, key, spec[key])
        except json.JSONDecodeError:
            raise SpecError('Error parsing json')

    def json(self, include_files=False):
        data = { c.name: getattr(self, c.name) for c in self.__table__.columns }
        for k in data:
            if isinstance(data[k], datetime):                               # Special handling for datetimes
                data[k] = str(data[k])
        if include_files: data['files'] = self.list_files()
        return data

    def delete(self):
        Project.remove(self)

    def duplicate(self, new_dir):
        src_dir = os.path.join(Config.instance().USERS_PATH, self.owner, self.dir)
        dst_dir = os.path.join(Config.instance().USERS_PATH, self.owner, new_dir)
        shutil.copytree(src_dir, dst_dir)
        runtime_access(dst_dir)

    def list_files(self):
        file_list = []
        dir_path = self.dir_path()
        for dir_, subdirs, files in os.walk(dir_path):
            for f in subdirs:
                if not f.startswith('.'):
                    f_data = os.stat(os.path.join(dir_, f))
                    file_list.append({'filename': os.path.relpath(os.path.join(os.path.relpath(dir_, dir_path), f) + '/', './'),
                                      'size': sizeof_fmt(f_data.st_size),
                                      'modified': str(datetime.fromtimestamp(f_data.st_mtime))})
            for f in files:
                if not f.startswith('.'):
                    f_data = os.stat(os.path.join(dir_, f))
                    file_list.append({'filename': os.path.relpath(os.path.join(os.path.relpath(dir_, dir_path), f), './'),
                                      'size': sizeof_fmt(f_data.st_size),
                                      'modified': str(datetime.fromtimestamp(f_data.st_mtime))})
        return file_list

    def min_metadata(self):
        return self.dir and self.image and self.name and self.owner

    def dir_path(self):
        return os.path.join(Config.instance().USERS_PATH, self.owner, self.dir)

    def save(self):
        # Ensure that the project has all of the required information
        if not self.min_metadata(): raise SpecError('Missing required attributes')
        # Save the project to the database and return the json representation
        project_json = Project.put(self)
        return project_json

    @staticmethod
    def from_spawner(owner, spawner):
        metadata = json.loads(spawner[2])
        data = {
            'dir': spawner[0],
            'owner': owner,
            'image': metadata['image'] if 'image' in metadata else '',
            'name': metadata['name'] if 'name' in metadata else spawner[0],
            'description': metadata['description'] if 'description' in metadata else '',
            'author': metadata['author'] if 'author' in metadata else '',
            'quality': metadata['quality'] if 'quality' in metadata else '',
            'tags': metadata['tags'] if 'tags' in metadata else '',
            'citation': metadata['citation'] if 'citation' in metadata else ''
        }
        return Project(json.dumps(data))

    @staticmethod
    def get(id=None, owner=None, dir=None):
        """Get project info from the projects database. If no info is found, fall back to querying the hub database"""

        # Attempt to query the projects database
        session = ProjectConfig.instance().Session()
        query = session.query(Project)
        if id is not None:      query = query.filter(Project.id == id)
        if owner is not None:   query = query.filter(Project.owner == owner)
        if dir is not None:     query = query.filter(Project.dir == dir)
        project = query.first()
        session.close()

        # Check to see if a project was retrieved, if so return it; if not, query the hub database
        if project is not None: return project

        # Check for the project in the hub database, return if found
        spawner = spawner_info(owner, dir)
        if spawner:
            metadata = json.loads(spawner[2])
            data = {
                'dir': dir,
                'owner': owner,
                'image': metadata['image'] if 'image' in metadata else '',
                'name': metadata['name'] if 'name' in metadata else spawner[0],
                'description': metadata['description'] if 'description' in metadata else '',
                'author': metadata['author'] if 'author' in metadata else '',
                'quality': metadata['quality'] if 'quality' in metadata else '',
                'tags': metadata['tags'] if 'tags' in metadata else '',
                'citation': metadata['citation'] if 'citation' in metadata else ''
            }
            return Project(json.dumps(data))
        else: return None

    @staticmethod
    def put(project):
        session = ProjectConfig.instance().Session()
        session.add(project)
        session.commit()
        d = project.json()
        session.close()
        return d  # Return the json representation

    @staticmethod
    def remove(project):
        session = ProjectConfig.instance().Session()
        session.delete(project)
        session.commit()
        session.close()

    @staticmethod
    def all(owner):
        # Attempt to query the projects database
        session = ProjectConfig.instance().Session()
        query = session.query(Project).filter(Project.owner == owner)
        results = query.all()
        session.close()

        # Check to see if projects were retrieved, if so return
        if len(results): return results

        # If not, query the hub database
        spawners = user_spawners(owner)
        projects = [Project.from_spawner(owner, s) for s in spawners if s[0] != '']
        return list(filter(lambda p: '.' not in p.dir, projects))      # Filter out shares


# Set database configuration
class ProjectConfig:
    _project_singleton = None
    db = None
    Session = None

    def __init__(self):
        config = Config.instance()
        self.db = create_engine(f'{config.DB_PROTOCOL}://{config.DB_PATH}', echo=config.DB_ECHO)
        self.Session = sessionmaker(bind=self.db)
        Base.metadata.create_all(self.db)

    @classmethod
    def instance(cls):
        if cls._project_singleton is None:
            cls._project_singleton = ProjectConfig()
        return cls._project_singleton


def unused_dir(user, dir_name):
    count = 1
    checked_name = dir_name
    while True:
        hub_user = encode_username(user)                            # Encoded JupyterHub username
        project_dir = os.path.join(Config.instance().USERS_PATH, hub_user, checked_name)  # Path to check
        if os.path.exists(project_dir):                             # If it exists, append a number and try again
            checked_name = f'{dir_name}{count}'
            count += 1
        else:
            return checked_name, count-1


def runtime_access(target_dir):
    """Allow access to the runtime directory (prevents errors in JupyterHub 2.3.x)"""
    local_dir = os.path.join(target_dir, '.local')
    if os.path.exists(local_dir):
        for root, dirs, files in os.walk(local_dir):
            os.chmod(root, 0o777)                                   # Set perms on root directory
            for d in dirs: os.chmod(os.path.join(root, d), 0o777)   # Set perms on subdirectories
            for f in files: os.chmod(os.path.join(root, f), 0o777)  # Set perms on files
