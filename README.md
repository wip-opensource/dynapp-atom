# dynapp-atom package

## Get started!

* Ensure you have atom of version >= 1.26.0
* Open your terminal, write apm install dynapp-atom
* Create an empty directory and open it with atom.
* In the menu, press `packages`, then `dynapp-atom`, then `create config file` (or press ctrl + alt + c)
* Open the new file 'dynappconfig.json' and enter your credentials.
* Press `packages` -> `dynapp-atom` -> `download project` (or ctrl + alt + d) to download your project from dynapp-server.
* You can now locally edit the files.
* To publish your changes, go to `packages` -> `dynapp-atom` -> `publish`. (or press ctrl + alt + u)
* You can also create new files from `packages` -> `dynapp-atom`


## dynappconfig.json

* **username** - The username and group separated with slash to use for requests againts DynApp.
* **password** - The password for the given user.
* **group** - The group name of the app to work against.
* **app** - The app id of the app to work against.
* **baseurl** - The base url of the DynApp server.
* **workpath** - Path to where the app files are saved relative to the config file.
* **rungroup** - For use with DynApp Webcomponents. Overrides the value of group when running a web with proxy locally.
* **runapp** - For use with DynApp Webcomponents. Overrides the value of app when running a web with proxy locally.
