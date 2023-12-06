import functools
import threading


def synchronized(wrapped):
    lock = threading.RLock()
    @functools.wraps(wrapped)
    def _wrapper(*args, **kwargs):
        with lock:
            return wrapped(*args, **kwargs)
    return _wrapper
