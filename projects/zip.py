import io
import os
import shutil
import threading
import zipfile
from datetime import datetime


def zip_dir(src_path, dest_path):
    if dest_path.endswith('.zip'): dest_path = dest_path[:-4]
    threading.Thread(target=shutil.make_archive, args=(dest_path, 'zip', src_path)).start()  # Zip dir in its own thread


def unzip_dir(src_path, dest_path):
    shutil.unpack_archive(src_path, dest_path, 'zip')
    for root, dirs, files in os.walk(dest_path):
        for d in dirs: os.chmod(os.path.join(root, d), 0o777)
        for f in files: os.chmod(os.path.join(root, f), 0o777)


def list_files(zip_path):
    files = []
    for f in zipfile.ZipFile(zip_path).infolist():
        if not f.filename.startswith('.'):
            files.append({'filename': f.filename,
                          'size': sizeof_fmt(f.file_size),
                          'modified': str(datetime(*f.date_time))})
    return files


def sizeof_fmt(num, suffix='B'):
    for unit in [' ',' K',' M',' G',' T',' P',' E',' Z']:
        if abs(num) < 1024.0:
            return "%3.0f%s%s" % (num, unit, suffix)
        num /= 1024.0
    return "%.1f%s%s" % (num, 'Yi', suffix)


def get_dir_size(dir_path, size_limit=None):
    total_size = 0
    for root, dirs, files in os.walk(dir_path):
        for f in files:
            fp = os.path.join(root, f)
            if not os.path.islink(fp):              # skip if it is symbolic link
                total_size += os.path.getsize(fp)
                # Abort if directory is over size limit
                if size_limit and total_size > size_limit:
                    raise RuntimeError('Exceeded maximum size limit')

    return total_size


def zip_buffer(dir_path):
    buffer = io.BytesIO()                           # Create the buffer
    path_prefix = len(os.path.dirname(dir_path))    # Number of characters in path prefix

    # Write the directory contents to the buffer
    with zipfile.ZipFile(buffer, "a", zipfile.ZIP_DEFLATED, False) as zip_file:
        for root, dirs, files in os.walk(dir_path):
            for file in files:
                full_path = os.path.join(root, file)
                name_in_zip = full_path[path_prefix+1:]
                zip_file.write(full_path, name_in_zip)

    buffer.seek(0)                                  # Return buffer back to beginning of memory
    return buffer                                   # Return the buffer
