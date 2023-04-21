const express = require("express");
let app = express();
const path = require("path");
const mysql = require('mysql');
const url = require('url');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const sessions = require('express-session'); 
const oneHour = 1000 * 60 * 60 * 1;


app.use(cookieParser());
app.use(express.static(path.join(__dirname,'./public')));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

// middleware to set the req variable in response locals
app.use(function(req, res, next) {
    res.locals.req = req;
    next();
  });

//middleware to config sesssion data
app.use(sessions({
   secret: "thisisasecretsession",
   saveUninitialized: true,
   cookie: { maxAge: oneHour },
   resave: false
}));

const connection = mysql.createConnection({
    host:'localhost',
    user: 'root',
    password: 'root',
    database: 'stacksofwax',
    port: '8889',
    multipleStatements: true
});

connection.connect((err)=>{
    if(err) return console.log(err.message);
    console.log("Connected to local MySQL Database");
});

app.get("/", (req, res) => {
    let sessionObj = req.session;

    if(sessionObj.sessValid) {
        res.redirect('home');
    } else {
        res.redirect('home');
    }  
  
});


app.get("/home", function (req, res) {
    let getid = req.query.bid;
   
    let read = `SELECT album_id, img_url FROM album LIMIT 9;

    SELECT album_id, album_name, artist_name, release_year, img_url FROM album WHERE album_id IN (
        SELECT album_id FROM album_genre WHERE genre_id = 1) LIMIT 10;`; 
   

     connection.query(read, [getid, getid], (err, albumdata)=>{
        if(err) throw err;

        let top_albums = albumdata[0];
        let album_genre_id = albumdata[1];
        
        res.render('index', {top_albums, album_genre_id});
    });
});





app.get("/album", (req, res) => {

    let getid = req.query.bid;
    let sessionObj = req.session;
    let user_id = sessionObj.user_id; 

    let getrow = ` SELECT album.album_id, album.album_name, album.artist_name,
                    album.release_year, album.img_url FROM album WHERE album_id = ?;
        
                    SELECT record_label_name FROM record_label WHERE record_label_id IN (
        SELECT record_label_id FROM album WHERE album_id = ?);
        
        SELECT track.track_title, track.duration, track.track_position_on_album FROM track WHERE track_id IN (
            SELECT track_id FROM track_album WHERE album_id = ?);
            
        SELECT review.user_id, review.rating, review.title, review.comment, review.date_posted, user.username
        FROM review
        INNER JOIN album_review ON review.review_id = album_review.review_id
        INNER JOIN user ON review.user_id = user.user_id
        WHERE album_review.album_id = ? LIMIT 3;
        
        SELECT collection_id, user_id, collection_name, collection_desc, main_genre_id
        FROM collection
        WHERE user_id = ?;
        
        SELECT genre_id, genre_type FROM genre;`;
            

    connection.query(getrow, [getid, getid, getid, getid, user_id], (err, albumrow)=>{  
        if(err) throw err;

        let album_details = albumrow[0];
        let record_label_details = albumrow[1]; 
        let track_details = albumrow[2];
        let review_details = albumrow[3];
        let all_user_collections = albumrow[4];
        let all_genres = albumrow[5];
        
        res.render('album', {album_details, record_label_details, track_details, review_details, all_user_collections, all_genres});
    });
});


app.post('/add_to_existing_collection', (req, res) => {
    
    let existing_collection_id = req.body.existing_collection_field;
    let album_id = url.parse(req.headers.referer, true).query.bid;

    let sqlinsert = `INSERT INTO album_collection (album_collection_id, collection_id, album_id)
    VALUES (NULL, "${existing_collection_id}", "${album_id}");`;
   
    connection.query(sqlinsert, (err, data) => {
        if (err) throw err;
        
        res.redirect(`/mycollections`);
    });
});


app.post('/create_new_collection', (req, res) => {
    
    let sessionObj = req.session;
    let user_id = sessionObj.user_id; 
    let title = req.body.title_field;
    let desc = req.body.description_field;
    let genre_id = req.body.genre_field;

    let sqlinsert = `INSERT INTO collection (collection_id, user_id, collection_name, collection_desc, main_genre_id)
    VALUES (NULL, "${user_id}", "${title}", "${desc}", "${genre_id}");`;
   
    connection.query(sqlinsert, (err, data) => {
        if (err) throw err;
        
        res.redirect(`/mycollections`);
    });
});


app.post('/add_to_new_collection', (req, res) => {
    
    let album_id = url.parse(req.headers.referer, true).query.bid;
    let sessionObj = req.session;
    let user_id = sessionObj.user_id; 
    let title = req.body.title_field;
    let desc = req.body.description_field;
    let genre_id = req.body.genre_field;

    let sqlinsert = `INSERT INTO collection (collection_id, user_id, collection_name, collection_desc, main_genre_id)
    VALUES (NULL, "${user_id}", "${title}", "${desc}", "${genre_id}");
    
    SET @last_id_in_collection = LAST_INSERT_ID();
    
    INSERT INTO album_collection (album_collection_id, collection_id, album_id)
    VALUES (NULL, @last_id_in_collection, "${album_id}");`;
    
   
    connection.query(sqlinsert, (err, data) => {
        if (err) throw err;
        
        res.redirect(`/mycollections`);
    });
});


app.post('/remove_from_collection', (req, res) => {

    let album_id = 

    let sqldelete = `DELETE FROM album_collection WHERE album_id = ? AND collection_id = ?;`;
    
    connection.query(sqlinsert, (err, data) => {
        if (err) throw err;
        
        res.redirect(`/mycollections`);
    });
});


app.post('/albumreview', (req, res) => {
    
    let title = req.body.title_field;
    let comment = req.body.comment_field;
    let rating = req.body.rating_field;
    let current_date = new Date().toLocaleDateString('en-UK', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).split('/').reverse().join('-'); // format current date as YYYY-MM-DD
   
    let album_id = url.parse(req.headers.referer, true).query.bid;

    let sessionObj = req.session;
    let user_id = sessionObj.user_id; 

    let sqlinsert = `INSERT INTO review (review_id, user_id, rating, title, comment, date_posted)
    VALUES (NULL, "${user_id}", "${rating}", "${title}", "${comment}", "${current_date}");

    SET @last_id_in_review = LAST_INSERT_ID();
    
    INSERT INTO album_review (album_review_id, review_id, album_id) VALUES (NULL, @last_id_in_review, "${album_id}");`;

    
    connection.query(sqlinsert, (err, data) => {
        if (err) throw err;
        
        res.redirect(`/album?bid=${album_id}`);
        
    });
});


app.get("/allalbums", (req, res) => {
    let getid = req.query.bid;

    let read = `SELECT album.album_id, album.album_name, album.artist_name, album.release_year, album.img_url, genre.genre_type
                FROM album
                LEFT JOIN album_genre ON album.album_id = album_genre.album_id
                LEFT JOIN genre ON album_genre.genre_id = genre.genre_id;

    SELECT DISTINCT genre_type
    FROM genre
    JOIN album_genre ON genre.genre_id = album_genre.genre_id;
    
    SELECT DISTINCT artist_name FROM album ORDER BY artist_name ASC;
    
    SELECT album.album_id, album.album_name, album.artist_name, album.release_year, album.img_url, GROUP_CONCAT(genre.genre_type) AS genre_types
        FROM album
        LEFT JOIN album_genre ON album.album_id = album_genre.album_id
        LEFT JOIN genre ON album_genre.genre_id = genre.genre_id
        GROUP BY album.album_id;`;

    connection.query(read, [getid, getid], (err, albumrow)=>{  
        if(err) throw err;
        
        album_details = albumrow[0];
        unique_genre_type = albumrow[1];
        unique_artist_name = albumrow[2];
        unique_artist_details = albumrow[3];
        
        res.render("all_albums", {album_details, unique_genre_type, unique_artist_name, unique_artist_details});
    });

});


app.get("/allcollections", (req, res) => {

    let getid = req.query.cid;

    let read = `SELECT c.collection_id, c.collection_name, c.collection_desc, u.username, g.genre_type
    FROM collection c
    INNER JOIN user u ON c.user_id = u.user_id
    INNER JOIN album_collection ac ON c.collection_id = ac.collection_id
    INNER JOIN genre g ON c.main_genre_id = g.genre_id
    GROUP BY c.collection_id;
                
    SELECT DISTINCT genre_type FROM genre WHERE genre_ID IN (
    SELECT genre_ID FROM album_genre WHERE album_id IN (
        SELECT album_ID FROM album_collection WHERE collection_id = ?));`;

    connection.query(read, [getid], (err, data)=>{
        if(err) throw err;

        let collection_data = data[0];
        let genre_type = data[1];

        
        
        res.render('all_collections', {collection_data, genre_type});
    });
    
});

app.get("/collection", (req, res) => {

    let getid = req.query.cid;

    let read = `SELECT album_id, album_name, artist_name, release_year, img_url FROM album WHERE album_id IN (
        SELECT album_id FROM album_collection WHERE collection_id = ?);
        
        SELECT u.first_name, u.last_name, u.username, c.collection_name, c.collection_desc, c.main_genre_id, g.genre_type
        FROM user u 
        JOIN collection c ON u.user_id = c.user_id 
        JOIN genre g ON c.main_genre_id = g.genre_id
        WHERE c.collection_id = ?;
        
        SELECT review.user_id, review.rating, review.title, review.comment, review.date_posted, user.username
        FROM review
        INNER JOIN collection_review ON review.review_id = collection_review.review_id
        INNER JOIN user ON review.user_id = user.user_id
        WHERE collection_review.collection_id = ?;
        
        SELECT collection_id FROM collection WHERE collection_id = ?;`;

    connection.query(read, [getid, getid, getid, getid], (err, collectionrow)=>{  
        if(err) throw err;

        let album_details = collectionrow[0];
        let user_details = collectionrow[1];
        let review_details = collectionrow[2];
        let collection_details = collectionrow[3];


        res.render('individual_collection', {album_details, user_details, review_details, collection_details} );
    });
});


app.post('/collectionreview', (req, res) => {
    
    let title = req.body.title_field;
    let comment = req.body.comment_field;
    let rating = req.body.rating_field;
    let current_date = new Date().toLocaleDateString('en-UK', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).split('/').reverse().join('-'); // format current date as YYYY-MM-DD to fit in database format
   
    let collection_id = url.parse(req.headers.referer, true).query.cid;

    let sessionObj = req.session;
    let user_id = sessionObj.user_id; 

    let sqlinsert = `INSERT INTO review (review_id, user_id, rating, title, comment, date_posted)
    VALUES (NULL, "${user_id}", "${rating}", "${title}", "${comment}", "${current_date}");

    SET @last_id_in_review = LAST_INSERT_ID();
    
    INSERT INTO collection_review (collection_review_id, review_id, collection_id) VALUES (NULL, @last_id_in_review, "${collection_id}");`;

    
    connection.query(sqlinsert, (err, data) => {
        if (err) throw err;
        
        res.redirect(`/collection?cid=${collection_id}`);
        
    });
});



app.get("/register", function (req, res) {
    let read = `SELECT username FROM user;`;

    connection.query(read, (err, row) => {  
        if(err) throw err;

        let usernames = row.map(user => user.username); // extract an array of usernames

        // check if username is already taken
        let usernameTaken = false;
        if (req.query.username && usernames.includes(req.query.username)) {
            usernameTaken = true;
        }

        res.render('register', { usernames, usernameTaken } );
    });
});




app.post('/registeruser', async (req, res) => {
    try {
      const firstname = req.body.firstname_field;
      const lastname = req.body.lastname_field;
      const username = req.body.username_field;
      const email = req.body.email_field;
      const plaintextPassword = req.body.password_field;
  
      // generate the salt 
      const saltRounds = 10;
      const salt = await bcrypt.genSalt(saltRounds);
  
      // hash the password
      const hashedPassword = await bcrypt.hash(plaintextPassword, salt);
  
      // insert user with hashed password
      const sqlinsert = `INSERT INTO user (user_id, first_name, last_name, username, email, password)
        VALUES (NULL, "${firstname}", "${lastname}", "${username}", "${email}", "${hashedPassword}");`;
  
      connection.query(sqlinsert, (err, data) => {
        if (err) throw err;
       
        let sessionObj = req.session;
        req.session.sessValid = true;

        res.redirect('/');
      });
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  });

app.get("/login", function (req, res) {
    res.render('login');
});

app.get("/mycollections", function (req, res) {
    let sessionObj = req.session;
    let user_id = sessionObj.user_id;

    let readCollections = `SELECT collection_id, user_id, collection_name, collection_desc, main_genre_id
        FROM collection WHERE user_id = ?;

    SELECT genre_id, genre_type FROM genre;`;

    connection.query(readCollections, [user_id], (err, collectionRows) => {
        if (err) throw err;

        let user_collections = collectionRows[0];

        if (user_collections.length === 0) {
            res.render('user_collections', { user_collections: [], all_genres: collectionRows[1] });
            return;
        }

        let numCollections = user_collections.length;
        let counter = 0;
        let all_genres = collectionRows[1];

        user_collections.forEach((collection, index) => {
            let collection_id = collection.collection_id;

            let readAlbums = `SELECT album.album_id, album.record_label_id, album.album_name, album.artist_name, album.release_year, album.img_url
                FROM album
                INNER JOIN album_collection ON album.album_id = album_collection.album_id
                WHERE album_collection.collection_id = ?;`;

            connection.query(readAlbums, [collection_id], (err, albumRows) => {
                if (err) throw err;

                user_collections[index].albums = albumRows;

                let readGenre = `SELECT genre.genre_type
                FROM collection
                JOIN genre ON collection.main_genre_id = genre.genre_id
                WHERE collection.collection_id = ?;`;

                connection.query(readGenre, [collection_id], (err, genreRow) => {
                    if (err) throw err;

                    user_collections[index].main_genre_id = genreRow[0].main_genre_id;

                    counter++;

                    if (counter === numCollections) {
                        res.render('user_collections', { user_collections, all_genres });
                    }
                });

            });
        });
    });
});




app.post('/edit_title', (req, res) => {

    let new_title = req.body.new_title_field;
    let old_title_id = req.body.original_id_field;

    let sqlinsert = `UPDATE collection SET collection_name = "${new_title}" WHERE collection_id = "${old_title_id}";`;
    
    connection.query(sqlinsert, (err, data) => {
        if (err) throw err;
        
        res.redirect('/mycollections');
        
    });
});

app.post('/edit_desc', (req, res) => {

    let new_desc = req.body.new_desc_field;
    let collection_id = req.body.original_id_field;

    let sqlinsert = `UPDATE collection SET collection_desc = "${new_desc}" WHERE collection_id = "${collection_id}";`;
    
    connection.query(sqlinsert, (err, data) => {
        if (err) throw err;
        
        res.redirect('/mycollections');
        
    });
});


app.post('/login', (req, res) => {
    const username = req.body.usernameField;
    const plaintextPassword = req.body.passwordField;
  
    const sqlSelect = 'SELECT * FROM user WHERE username = ?';
    
    connection.query(sqlSelect, [username], async (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Server error');
      }
  
      if (rows.length === 0) {
        // No user found with given username
        return res.render('login');
      }
  
      const hashedPassword = rows[0].password;
  
      try {
        const passwordMatches = await bcrypt.compare(plaintextPassword, hashedPassword);
        if (passwordMatches) {
          // Passwords match, start session and redirect to home page
          let sessionObj = req.session;  
          sessionObj.user_id = rows[0].user_id;
          sessionObj.sessValid = true;
          return res.redirect('/home');
        } else {
          // Passwords don't match
          return res.render('login');
        }
      } catch (err) {
        console.error(err);
        return res.status(500).send('Server error');
      }
    });
  });
  
  



// Add a route for handling logout
app.get("/logout", (req, res) => {
    // Destroy session and redirect to login page
    req.session.destroy();
    res.redirect("/login");
});
  
app.listen(process.env.PORT || 3000);
console.log('Server is listening at https://localhost:3000/');