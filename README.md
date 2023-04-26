# stacksofwax

To run my system on your local machine, you would need to follow the below steps:

1.	Ensure Node.js  and Visual Studio Code  are downloaded on your machine.
2.	Expand my mgreen23.zip file onto your desktop, and ensure you can see the files inside.
3.	Open VSCode, navigate to the File menu, select the mgreen23 folder and select “Open Folder” on the “System Source Code” folder.
4.	Ensure you have MAMP  (Apple Mac) or XAMP  (Windows) installed on your computer, and then follow the respective instructions to run/open a phpMyAdmin server.
5.	Click on ‘import’ on the menu bar and import the ‘40354200.sql’ data from the mgreen23 folder. You should now have a database set-up with the required dataset to run the system.
6.	Return to the Visual Studio Code app, head to the Terminal menu in the menu bar and select “New Terminal”.
7.	Enter ‘npm install’ into the Terminal window to install all the required dependencies listed in the package.json file. IF there are any issues completing this, please install the dependencies by typing as follows:
npm install express path mysql url bcrypt cookie-parser express-session nodemon ejs body-parser --save
8.	Install nodemon by running the command: npm install nodemon –save-dev 
9.	Now, type ‘npx nodemon’ into the Terminal window to establish a connection with the database. If the above instructions have been followed (and therefore the database and dataset have been created, and all system dependencies have been installed), then the Terminal should print a message advising it is listening at localhost:3000 and the database is connected.
10.	Head to the URI the server is listening at (http://localhost:3000/) and the website should load successfully.
