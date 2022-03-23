import os
import sys
from projects.hub import UserHandler, PreviewHandler, StatsHandler, pre_spawn_hook, spawner_escape

c = get_config()

# Spawner config
c.JupyterHub.spawner_class = 'dockerspawner.DockerSpawner'
c.DockerSpawner.image = 'genepattern/lab'
c.DockerSpawner.remove_containers = True
c.DockerSpawner.image_whitelist = {
    'Lab': 'g2nb/lab',
}
c.DockerSpawner.escape = spawner_escape
c.DockerSpawner.name_template = "{prefix}-{username}-{servername}"
c.DockerSpawner.pre_spawn_hook = lambda spawner: pre_spawn_hook(spawner, userdir='./data/users')
c.DockerSpawner.volumes = {
    os.path.join(os.getcwd(), './data/users/{raw_username}/{raw_servername}'): '/home/jovyan',  # Mount users directory
}

# Named server config
c.JupyterHub.allow_named_servers = True
c.JupyterHub.default_url = '/home'
c.JupyterHub.extra_handlers = [('user.json', UserHandler), ('preview', PreviewHandler), ('stats', StatsHandler)]

# Template config
c.JupyterHub.template_paths = ['./templates']

# Enable CORS
origin = '*'
c.Spawner.args = [f'--NotebookApp.allow_origin={origin}', '--NotebookApp.allow_credentials=True', "--NotebookApp.tornado_settings={\"headers\":{\"Referrer-Policy\":\"no-referrer-when-downgrade\"}}"]
c.JupyterHub.tornado_settings = {
    'headers': {
        'Referrer-Policy': 'no-referrer-when-downgrade',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
    },
}

# Services
c.JupyterHub.load_roles = [
    {
        "name": "user",
        "scopes": ["access:services", "self"],  # grant all users access to all services
    },
    {
        "name": "projects",
        "scopes": [
            "self",
        ],
        "services": ["projects"],
    },
]

c.JupyterHub.services = [
    {
        'name': 'projects',
        'admin': True,
        'url': 'http://127.0.0.1:3000/',
        'cwd': '.',
        'oauth_no_confirm': True,
        'environment': {
            'IMAGE_WHITELIST': ','.join(c.DockerSpawner.image_whitelist.keys())
        },
        'command': [sys.executable, 'start-projects.py',
                    '--config=/Users/tmtabor/workspace/notebook-repository/data/projects_config.py']
    },
]
