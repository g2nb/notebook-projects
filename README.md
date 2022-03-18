# Notebook Projects

This service allows JupyterHub users to create multiple workspace environments, called “projects.” Each project allows 
users to independently install extensions, libraries, data files and other dependencies necessary for their workflows.

Users should be able to leverage notebook projects to keep independent work separate, to manage mutually-conflicting 
dependencies and to support a diverse array of computational tools.

# Installation

1. Copy the `projects` directory to your Python path.
2. Configure JupyterHub to run projects as a managed service. Look at `jupyterhub_config.py` for example configuration.
3. Place the `start-projects.py` and `projects_config.py` files in the directory from which the service will be run. You 
   may need to change `projects_config.py` point to the directories where you want to store user data.
4. Place the contents of the `static` directory in your Jupyter share directory, this will allow the custom templates to 
   load the necessary js and css for the frontend.