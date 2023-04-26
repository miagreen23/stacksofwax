const express = require("express");
let app = express();
const path = require("path");
const mysql = require('mysql');
const url = require('url');
const bcrypt = require('bcrypt');
const cookieParser = require('cookie-parser');
const sessions = require('express-session'); 
const { reset } = require("nodemon");
const { resolveSoa } = require("dns");
const oneHour = 1000 * 60 * 60 * 1;
const bodyParser = require('body-parser');

app.use(cookieParser());
app.use(express.static(path.join(__dirname,'./public')));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));
app.use(bodyParser.urlencoded({ extended: true }));

// middleware to set the req variable in response locals
app.use(function(req, res, next) {
    res.locals.req = req;
    next();
});

// middleware to config sesssion data
app.use(sessions({
   secret: "thisisasecretsession",
   saveUninitialized: true,
   cookie: { maxAge: oneHour },
   resave: false
}));

// variable to contain the db connection
const connection = mysql.createConnection({
    host:'localhost',
    user: 'root',
    password: 'root',
    database: '40354200',
    port: '8889',
    multipleStatements: true
});

// output message if db connection is successful
connection.connect((err)=>{
    if(err) return console.log(err.message);
    console.log("Connected to local MySQL Database");
});
  
// app.listen to print to console the port details
app.listen(process.env.PORT || 3000);
console.log('Server is listening at https://localhost:3000/');

// app.get to redirect default / route to /home
app.get("/", (req, res) => {
    res.redirect('home');
});

// app.get to render the homepage, check if user is logged in and provide personalised "top picks"
// if they are logged in
app.get("/home", function (req, res) {
    let sessionObj = req.session;
    let user_id = sessionObj.user_id;
    let read;
  
    if (user_id) {
      // User is logged in, render queries with user-specific genre
      let read_albums = `SELECT album_id, img_url FROM album LIMIT 9;`;
  
      // Check if user has any collections
      let check_collections = `SELECT COUNT(*) as count FROM collection WHERE user_id = ?;`;
  
      connection.query(check_collections, [user_id], (err, result) => {
            if (err) throw err;
            let read_genre;

            if (result[0].count > 0) {       
                // User has collections, fetch albums of the user's most chosen genre
                    read_genre = `SET @main_genre = COALESCE((
                    SELECT g.genre_id
                    FROM collection c
                    JOIN genre g ON c.main_genre_id = g.genre_id
                    WHERE c.user_id = ?
                    GROUP BY c.main_genre_id
                    ORDER BY COUNT(*) DESC
                    LIMIT 1), 1);
                
                    SELECT album_id, album_name, artist_name, release_year, img_url 
                    FROM album WHERE album_id IN (
                        SELECT album_id FROM album_genre WHERE genre_id = @main_genre) LIMIT 10;`;
            } else {
                    // User has no collections, fetch albums of genre 1
                    read_genre = `SELECT album_id, album_name, artist_name, release_year, img_url FROM album WHERE album_id IN (
                    SELECT album_id FROM album_genre WHERE genre_id = 1) LIMIT 10;`;           
            }
            
            read = read_albums + read_genre;
    
            connection.query(read, [user_id], (err, albumdata) => {
                if (err) throw err;
                    let top_albums = albumdata[0]; //accesses first 9 albums in database
                    let album_genre_id = null;
                    let albums_by_genre = null;
            
                if (result[0].count > 0) {
                    album_genre_id = albumdata[1];
                    albums_by_genre = albumdata[2]; //accesses all albums of the user's most chosen genre if they are logged in
                
                } else {
                    // User has no collections, fetch albums of genre 1 for top picks
                    let read_top_picks = `SELECT album_id, album_name, artist_name, release_year, img_url FROM album WHERE album_id IN (
                    SELECT album_id FROM album_genre WHERE genre_id = 1) LIMIT 10;`;
                        
                    connection.query(read_top_picks, (err, top_picks_data) => {
                        if (err) throw err;
                        top_albums = top_picks_data;
                    });
                }
                
                res.render("index", { top_albums, album_genre_id, albums_by_genre });
            
            });
        });

    } else {

      // User is not logged in, render original queries
      read = `SELECT album_id, img_url FROM album LIMIT 9;
              SELECT album_id, album_name, artist_name, release_year, img_url FROM album WHERE album_id IN (
                SELECT album_id FROM album_genre WHERE genre_id = 1) LIMIT 10;`;
  
      connection.query(read, (err, albumdata) => {
        if (err) throw err;
  
        let top_albums = albumdata[0]; //accesses first 9 albums in database
        let album_genre_id = albumdata[1];
        let albums_by_genre = albumdata[2]; //accesses all albums of the user's most chosen genre if they are logged in
  
        res.render("index", { top_albums, album_genre_id, albums_by_genre });
      });
    }
  });
  
// app.get to render the user's personalised 'my account' page, showing their account details  
app.get("/myaccount", function (req, res) {
    
    //variables containing the user_id in the current session 
    let sessionObj = req.session;
    let user_id = sessionObj.user_id; 
    
    if (!user_id) {
        // user is not logged in, redirect to login page or display error message
        res.redirect('/login');
        return;
    }
   
    let read = `SELECT user_id, first_name, last_name, username, email FROM user WHERE user_id = ?;
    
    SELECT c.collection_id, c.user_id, c.collection_name, c.collection_desc, c.main_genre_id, g.genre_type
    FROM collection c
    INNER JOIN genre g ON c.main_genre_id = g.genre_id
    WHERE c.user_id = ?;
    
    SELECT r.review_id, r.rating, r.title, r.comment, c.collection_name
    FROM review r
    INNER JOIN collection_review cr ON r.review_id = cr.review_id
    INNER JOIN collection c ON cr.collection_id = c.collection_id
    WHERE c.user_id = ?;`; 
   
    connection.query(read, [user_id, user_id, user_id], (err, user)=>{
        if(err) throw err;

        let user_data = user[0]; //variable containing all user details for current session user
        let user_collections = user[1]; //variable containing all the collections each user has made
        let collection_reviews = user[2]; //variable containing how many reviews each of the user's collections have
        
        res.render('myaccount', {user_data, user_collections, collection_reviews});
    });
});


// app.post to update the current user's first name in the database
app.post('/update_first_name', (req, res) => {
    // variables containing the user_id in the current session 
    let sessionObj = req.session;
    let user_id = sessionObj.user_id; 
    let new_first_name = req.body.first_name_field; // variable to capture the new first name

    let sqlinsert = `UPDATE user SET first_name = ? WHERE user_id = ?;`; // query to replace old first name with new one in database
    
    connection.query(sqlinsert, [new_first_name, user_id], (err, data) => {
        if (err) throw err;
        res.redirect('/myaccount'); // after updating the first name, the user will be redirected back to their account page to see new details
    });
});

// app.post to update the current user's last name in the database
app.post('/update_last_name', (req, res) => {
    // variables containing the user_id in the current session 
    let sessionObj = req.session;
    let user_id = sessionObj.user_id; 
    let new_last_name = req.body.last_name_field; // variable to capture the new last name

    let sqlinsert = `UPDATE user SET last_name = ? WHERE user_id = ?;`; //query to replace old last name with new one in database
    
    connection.query(sqlinsert, [new_last_name, user_id], (err, data) => {
        if (err) throw err;
        res.redirect('/myaccount'); // after updating the last name, the user will be redirected back to their account page to see new details
    });
});

// app.post to update the current user's username in the database
app.post('/update_username', (req, res) => {
    // variables containing the user_id in the current session 
    let sessionObj = req.session;
    let user_id = sessionObj.user_id; 
    let new_username = req.body.username_field; // variable to capture the new username

    let sqlinsert = `UPDATE user SET username = ? WHERE user_id = ?;`; // query to replace old username with new one in database
    
    connection.query(sqlinsert, [new_username, user_id], (err, data) => {
        if (err) throw err;
        res.redirect('/myaccount'); // after updating the username, the user will be redirected back to their account page to see new details
    });
});

// app.post to update the current user's email address in the database
app.post('/update_email', (req, res) => {
    // variables containing the user_id in the current session   
    let sessionObj = req.session;
    let user_id = sessionObj.user_id; 
    let new_email = req.body.email_field; // variable to capture the new email

    let sqlinsert = `UPDATE user SET email = ? WHERE user_id = ?;`; // query to replace old email with new one in database
    
    connection.query(sqlinsert, [new_email, user_id], (err, data) => {
        if (err) throw err;
        res.redirect('/myaccount'); // after updating the email, the user will be redirected back to their account page to see new details
    });
});

// app.get rendering the page for an individual album, along with it's corresponding tracklist, reviews etc.
app.get("/album", (req, res) => {
    let album_id = req.query.bid; //variable containing the album id
    let sessionObj = req.session; //variables containing the user_id in the current session
    let user_id = sessionObj.user_id; 

    //query capturing all details for each album
    let individual_album_details_sql = `SELECT album.album_id, album.album_name, album.artist_name,
    album.release_year, album.img_url FROM album WHERE album_id = ?;`;

    //query containing record label info
    let individual_album_record_label_sql = `SELECT record_label_name FROM record_label WHERE record_label_id IN (
        SELECT record_label_id FROM album WHERE album_id = ?);`;
        
    //query capturing all tracks on each album
    let individual_album_tracklist_sql = `SELECT track.track_title, track.duration, track.track_position_on_album FROM track WHERE track.track_id IN (
        SELECT track_id FROM track_album WHERE album_id = ?);`;
              
    //query capturing all reviews for each album
    let individual_album_reviews_sql = `SELECT review.user_id, review.rating, review.title, review.comment, review.date_posted, user.username
    FROM review
    INNER JOIN album_review ON review.review_id = album_review.review_id
    INNER JOIN user ON review.user_id = user.user_id
    WHERE album_review.album_id = ? LIMIT 3;`;
            
    //query capturing all user's collections, to be used in "add to collection" modal
    let all_user_collections_sql = `SELECT collection_id, user_id, collection_name, collection_desc, main_genre_id
    FROM collection WHERE user_id = ?;`;
        
    //query capturing all genres from genre table, to be used in "create new collection" modal
    let genre_list_sql = `SELECT genre_id, genre_type FROM genre;`;   
        
    //query capturing total likes each album has received
    let total_likes_sql = ` SELECT likes FROM album WHERE album_id = ?;`;    

    //query capturing the current user who is logged in
    let current_session_user_sql = `SELECT u.user_id, u.first_name, u.last_name, u.username, c.collection_id, c.collection_name, c.collection_desc, c.main_genre_id, g.genre_type
    FROM user u 
    JOIN collection c ON u.user_id = c.user_id 
    JOIN genre g ON c.main_genre_id = g.genre_id
    WHERE u.user_id = ?;`;

    let left_review_before_sql = `SELECT * FROM album WHERE album_id = ?;
    
    SELECT *
    FROM review r
    INNER JOIN album_review ar ON r.review_id = ar.review_id
    WHERE r.user_id = ? AND ar.album_id = ?;`;
        
    let results = {}; // array to store results of each query

    connection.query(individual_album_details_sql, [album_id], (err, album_details) => {
        if (err) throw err;
        results.album_details = album_details;

        connection.query(individual_album_record_label_sql, [album_id], (err, record_label) => {
            if (err) throw err;
            results.record_label = record_label;

            connection.query(individual_album_tracklist_sql, [album_id], (err, tracklist) => {
                if (err) throw err;
                results.tracklist = tracklist;
    
                connection.query(individual_album_reviews_sql, [album_id], (err, album_reviews) => {
                    if (err) throw err;
                    results.album_reviews = album_reviews;
        
                    connection.query(all_user_collections_sql, [user_id], (err, user_collections) => {
                        if (err) throw err;
                        results.user_collections = user_collections;
            
                        connection.query(genre_list_sql, (err, genre_list) => {
                            if (err) throw err;
                            results.genre_list = genre_list;
                
                            connection.query(total_likes_sql, [album_id], (err, total_likes) => {
                                if (err) throw err;
                                results.total_likes = total_likes;
                            
                                connection.query(current_session_user_sql, [user_id], (err, current_session_user) => {
                                    if (err) throw err;
                                    results.current_session_user = current_session_user;
                        
                                
                                    connection.query(left_review_before_sql, [album_id, user_id, album_id], (err, left_review_before) => {
                                        if (err) throw err;
                                        hasLeftReview = left_review_before[0];
                                        
                                        let reviewf;
                                        let reviewnum = left_review_before[1].length;

                                        if(reviewnum > 0) {
                                            reviewf = true;
                                        } else {
                                            reviewf = false;
                                        }

                                        res.render('album', { results: results, rflag: reviewf, hasLeftReview });

                                    }); 
                                    
                                });    
                            }); 
                        });  
                    });   
                });   
            });   
        });   
    });   
});

// app.post to add an album to a user's existing collection
app.post('/add_to_existing_collection', (req, res) => {
    // variables to capture the album_id and the collection_id they'd like to add into
    let album_id = url.parse(req.headers.referer, true).query.bid;
    let existing_collection_id = req.body.existing_collection_field;

    let checkSql = `SELECT COUNT(*) AS count FROM album_collection WHERE collection_id = ? AND album_id = ?;`;

    connection.query(checkSql, [existing_collection_id, album_id], (err, result) => {
        if (err) throw err;
       
        if (result[0].count > 0) {
            // if album_id already exists in the chosen collection, redirect to collections page
            res.redirect(`/mycollections`);

        } else {
            // if album_id doesn't exist, insert it into album_collection table
            let sqlinsert = `INSERT INTO album_collection (album_collection_id, collection_id, album_id)
            VALUES (NULL, ?, ?);`;
           
            connection.query(sqlinsert, [existing_collection_id, album_id], (err, data) => {
                if (err) throw err;
                res.redirect(`/mycollections`);
            });
        }
    });
});

// app.post to allow a user to create an entirely new collection in the database
app.post('/create_new_collection', (req, res) => {
    // variables to capture form data
    let sessionObj = req.session;
    let user_id = sessionObj.user_id; 
    let title = req.body.title_field;
    let desc = req.body.description_field;
    let genre_id = req.body.genre_field;

    let sqlinsert = `INSERT INTO collection (collection_id, user_id, collection_name, collection_desc, main_genre_id, likes)
    VALUES (NULL, ?, ?, ?, ?, "0");`;
   
    connection.query(sqlinsert, [user_id, title, desc, genre_id], (err, data) => {
        if (err) throw err;
        res.redirect(`/mycollections`);
    });
});

// app.post to add an album to a new collection (create a collection and add an album to it in one post action)
app.post('/add_to_new_collection', (req, res) => {
    // variables to capture form data
    let album_id = url.parse(req.headers.referer, true).query.bid;
    let sessionObj = req.session;
    let user_id = sessionObj.user_id; 
    let title = req.body.title_field;
    let desc = req.body.description_field;
    let genre_id = req.body.genre_field;

    let sqlinsert = `INSERT INTO collection (collection_id, user_id, collection_name, collection_desc, main_genre_id, likes)
    VALUES (NULL, ?, ?, ?, ?, "0");
    
    SET @last_id_in_collection = LAST_INSERT_ID();
    
    INSERT INTO album_collection (album_collection_id, collection_id, album_id)
    VALUES (NULL, @last_id_in_collection, ?);`;
    
    connection.query(sqlinsert, [user_id, title, desc, genre_id, album_id], (err, data) => {
        if (err) throw err;
        res.redirect(`/mycollections`);
    });
});

// app.post to remove a selected album from a specified collection
app.post('/remove_from_collection', (req, res) => {
    // variables to capture form data of which album and collection to update
    let album_id = req.body.album_id_field;
    let collection_id = req.body.collection_id_field;

    let sqldelete = `DELETE FROM album_collection WHERE album_id = ? AND collection_id = ?;`;
   
    connection.query(sqldelete, [album_id, collection_id], (err, data) => {
        if (err) throw err;
        res.redirect(`/mycollections`);
    });
});

// app.post to insert a new review into the review table, then add this review into the album_review table
app.post('/albumreview', (req, res) => {
    // variables to capture form data for insert
    let title = req.body.title_field;
    let comment = req.body.comment_field;
    let rating = req.body.rating_field;
    let current_date = new Date().toLocaleDateString('en-UK', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).split('/').reverse().join('-'); // format current date as YYYY-MM-DD
   
    let album_id = url.parse(req.headers.referer, true).query.bid; // variable parsing album_id from the URL

    // variables capturing the user_id from the current logged-in session
    let sessionObj = req.session;
    let user_id = sessionObj.user_id; 

    let sqlinsert = `INSERT INTO review (review_id, user_id, rating, title, comment, date_posted)
    VALUES (NULL, ?, ?, ?, ?, ?);

    SET @last_id_in_review = LAST_INSERT_ID();
    
    INSERT INTO album_review (album_review_id, review_id, album_id) VALUES (NULL, @last_id_in_review, ?);`;

    connection.query(sqlinsert, [user_id, rating, title, comment, current_date, album_id], (err, data) => {
        if (err) throw err;
        res.redirect(`/album?bid=${album_id}`);
    });
});

// app.post to submit one 'like' into the corresponding 'likes' field in the album table each time it is clicked
app.post('/submit_like_album', (req, res) => {
    // variable to parse the album_id from the URL
    let album_id = url.parse(req.headers.referer, true).query.bid;

    let sqlinsert = `UPDATE album SET likes = likes + 1 WHERE album_id = ?;`;
   
    connection.query(sqlinsert, [album_id], (err, data) => {
        if (err) throw err;
        res.redirect(`/album?bid=${album_id}`);
    });
});

// app.post to submit one 'like' into the corresponding 'likes' field in the collection table each time it is clicked
app.post('/submit_like_collection', (req, res) => {
    // variable to parse the collection_id from the URL
    let collection_id = url.parse(req.headers.referer, true).query.cid;

    let sqlinsert = `UPDATE collection SET likes = likes + 1 WHERE collection_id = ?;`;
   
    connection.query(sqlinsert, [collection_id], (err, data) => {
        if (err) throw err;
        res.redirect(`/collection?cid=${collection_id}`);
    });
});

// app.get to render all albums in the database and their corresponding info
app.get("/allalbums", function (req, res) {
    let all_genres_sql = `SELECT genre_id, genre_type FROM genre;`

    let all_artists_sql = `SELECT DISTINCT artist_name FROM album ORDER BY artist_name ASC;`

    let album_and_genres_sql = `SELECT album.album_id, album.album_name, album.artist_name, album.release_year, album.img_url, genre.genre_type
    FROM album
    LEFT JOIN album_genre ON album.album_id = album_genre.album_id
    LEFT JOIN genre ON album_genre.genre_id = genre.genre_id;`;

    // the results are stored in an array of results
    let results = {};

    connection.query(all_genres_sql, (err, genre_list) => {
        if (err) throw err;
        results.genre_list = genre_list;

        connection.query(all_artists_sql, (err, artist_list) => {
            if (err) throw err;
            results.artist_list = artist_list;

            connection.query(album_and_genres_sql, (err, album_and_genres) => {
                if (err) throw err;
                results.album_and_genres = album_and_genres;
               
                res.render('all_albums', { results: results });
            });
        });
    });
});

// app.get to render all collections in the database, as well as their corresponding details
app.get("/allcollections", (req, res) => {
    // variable to capture the collection_id
    let collection_id = req.query.cid;

    let collection_details_sql = `SELECT c.collection_id, c.collection_name, c.collection_desc, u.username, g.genre_type
    FROM collection c
    INNER JOIN user u ON c.user_id = u.user_id
    INNER JOIN album_collection ac ON c.collection_id = ac.collection_id
    INNER JOIN genre g ON c.main_genre_id = g.genre_id
    GROUP BY c.collection_id;`;
                
    let collection_genre_sql = `SELECT DISTINCT genre_type FROM genre WHERE genre_ID IN (
    SELECT genre_ID FROM album_genre WHERE album_id IN (
        SELECT album_ID FROM album_collection WHERE collection_id = ?));`;

    let results = {};

    connection.query(collection_details_sql, (err, collection_details) => {
        if (err) throw err;
        results.collection_details = collection_details;

        connection.query(collection_genre_sql, [collection_id], (err, genre_details) => {
            if (err) throw err;
            results.genre_details = genre_details;

            res.render('all_collections', { results: results });
        });
    });   
});

// app.get to render a page for each individual collection and it's details/content
app.get("/collection", (req, res) => {
    // variable to capture collection_id
    let collection_id = req.query.cid;

    let sessionObj = req.session;
    let user_id = sessionObj.user_id; 

    let albums_in_collection_sql = `SELECT album_id, album_name, artist_name, release_year, img_url FROM album WHERE album_id IN (
        SELECT album_id FROM album_collection WHERE collection_id = ?);`;

    let collection_owner_details_sql = `SELECT u.user_id, u.first_name, u.last_name, u.username, c.collection_id, c.collection_name, c.collection_desc, c.main_genre_id, g.genre_type
    FROM user u 
    JOIN collection c ON u.user_id = c.user_id 
    JOIN genre g ON c.main_genre_id = g.genre_id
    WHERE c.collection_id = ?;`;
        
    let collection_review_data_sql = `SELECT review.user_id, review.rating, review.title, review.comment, review.date_posted, user.username
    FROM review
    INNER JOIN collection_review ON review.review_id = collection_review.review_id
    INNER JOIN user ON review.user_id = user.user_id
    WHERE collection_review.collection_id = ?;`;
        
    let is_owner_of_collection_sql = `SELECT collection_id, user_id FROM collection WHERE collection_id = ?;`;

    let left_review_before_sql = `SELECT * FROM collection WHERE collection_id = ?;
    
    SELECT *
    FROM review r
    INNER JOIN collection_review cr ON r.review_id = cr.review_id
    WHERE r.user_id = ? AND cr.collection_id = ?;`;

    let total_likes_sql = ` SELECT likes FROM collection WHERE collection_id = ?;`; 

    let results = {};

    connection.query(albums_in_collection_sql, [collection_id], (err, albums_in_collection)=>{  
        if(err) throw err;
        results.albums_in_collection = albums_in_collection;
    
        connection.query(collection_owner_details_sql, [collection_id], (err, collection_owner_details)=>{  
            if(err) throw err;
            results.collection_owner_details = collection_owner_details;
        
            connection.query(collection_review_data_sql, [collection_id], (err, collection_review_data)=>{  
                if(err) throw err;
                results.collection_review_data = collection_review_data;

                connection.query(total_likes_sql, [collection_id], (err, total_likes)=>{  
                    if(err) throw err;
                    results.total_likes = total_likes;
            
                    connection.query(is_owner_of_collection_sql, [collection_id], (err, rows)=>{  
                        if(err) throw err;
                        
                        let isOwnerf;
                        let collection_owner_id = rows[0].user_id; // modified line

                        if (collection_owner_id === user_id) {
                            isOwnerf = true;
                        } else {
                            isOwnerf = false; // corrected variable name
                        }
                    
                        connection.query(left_review_before_sql, [collection_id, user_id, collection_id], (err, rows) => {
                            if (err) throw err;
                            album = rows[0];
                            
                            let reviewf;
                            let reviewnum = rows[1].length;

                            if (rows[1].length === 0) {
                                reviewf = false;
                            } else {
                                reviewf = true;
                            }

                            res.render('individual_collection', { results: results, cflag: isOwnerf, collection_owner_id, rflag: reviewf, album});   

                        });   
                    });                                    
                });
            });  
        });
    });
});

// app.post to post a user's review to the review table, and then post this review to the collection_review table
app.post('/collectionreview', (req, res) => {
    // variables capturing the form data for the review
    let title = req.body.title_field;
    let comment = req.body.comment_field;
    let rating = req.body.rating_field;
    let current_date = new Date().toLocaleDateString('en-UK', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
      }).split('/').reverse().join('-'); // format current date as YYYY-MM-DD to fit in database format
   
    let collection_id = url.parse(req.headers.referer, true).query.cid; // variable parsing the collection_id from the URL

    // variables capturing the user_id of the person currently logged into the session
    let sessionObj = req.session;
    let user_id = sessionObj.user_id; 

    let sqlinsert = `INSERT INTO review (review_id, user_id, rating, title, comment, date_posted)
    VALUES (NULL, ?, ?, ?, ?, ?);

    SET @last_id_in_review = LAST_INSERT_ID();
    
    INSERT INTO collection_review (collection_review_id, review_id, collection_id) VALUES (NULL, @last_id_in_review, ?);`;
    
    connection.query(sqlinsert, [user_id, rating, title, comment, current_date, collection_id], (err, data) => {
        if (err) throw err;

        res.redirect(`/collection?cid=${collection_id}`);
    });
});

// app.get to render a page containing the logged-in user's collections, and the ability to edit these collections
app.get("/mycollections", function (req, res) {
    // variables capturing the current logged-in user
    let sessionObj = req.session;
    let user_id = sessionObj.user_id;

    let readCollections = `SELECT collection_id, user_id, collection_name, collection_desc, main_genre_id
        FROM collection WHERE user_id = ?;

    SELECT genre_id, genre_type FROM genre;`;

    connection.query(readCollections, [user_id], (err, collectionRows) => {
        if (err) throw err;

        let user_collections = collectionRows[0];

        // if statement checking if the user actually has any collections
        if (user_collections.length === 0) {
            res.render('user_collections', { user_collections: [], all_genres: collectionRows[1] });
            return;
        }

        let numCollections = user_collections.length;
        let counter = 0;
        let all_genres = collectionRows[1];

        // functioning capturing all the details for the collections the user has made
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

// app.get to render the search function page
app.get("/search", function (req, res) {
    res.render('search', { sql_results: null, user: null, genre: null, artist: null });
});

// app.post to run the search SQL queries based on what the user inputs into the search field
app.post("/mysearch", function (req, res) {
    // variable to capture what the user would like to search for
    let result = req.body.search_field;

    // query to search all album and artist names
    let artist_album_sql = `SELECT album_id, album_name, artist_name, release_year, img_url, likes
    FROM album
    WHERE artist_name LIKE ?
       OR album_name LIKE ?`;

    // query to search all usernames 
    let user_sql = `SELECT user_id, username FROM user WHERE username LIKE ?`;
    
    // query to search all genres
    let genre_sql = `SELECT a.album_id, a.album_name, a.artist_name, a.release_year, a.img_url, a.likes, g.genre_type
                    FROM album a
                    JOIN album_genre ag ON a.album_id = ag.album_id
                    JOIN genre g ON ag.genre_id = g.genre_id
                    WHERE g.genre_type LIKE ?`;

    // results are added into a results array
    let results = {};

    connection.query(artist_album_sql, ['%' + result + '%', '%' + result + '%'], (err, artist_album) => {
        if (err) throw err;
        results.artist_album = artist_album;

        connection.query(user_sql, ['%' + result + '%'], (err, user) => {
            if (err) throw err;
            results.user = user;

            connection.query(genre_sql, ['%' + result + '%'], (err, genre) => {
                if (err) throw err;
                results.genre = genre;
        
                res.render('search_results', { results: results });
            });
        });
    });
});

// app.get to render the account registration page
app.get("/register", function (req, res) {
    let message = req.query.m;
    res.render('register', {m: message});
});

// app.post to add the new user's details into the database
app.post('/register', (req, res) => {
    try {
      const firstname = req.body.firstname_field;
      const lastname = req.body.lastname_field;
      const username = req.body.username_field;
      const email = req.body.email_field;
      const plaintextPassword = req.body.password_field;
  
      // query to check if username already exists
      const sqlCheckUsername = `SELECT COUNT(*) AS usernameCount FROM user WHERE username = ?`;
      connection.query(sqlCheckUsername, [username], (err, data) => {
        if (err) throw err;
  
        const usernameCount = data[0].usernameCount;
  
        if (usernameCount > 0) {
            res.redirect('/register/?m=Username already exists');
        } else {
          // generate the salt
          const saltRounds = 10;
          bcrypt.genSalt(saltRounds, (err, salt) => {
            if (err) throw err;
  
            // then hash the password
            bcrypt.hash(plaintextPassword, salt, (err, hashedPassword) => {
              if (err) throw err;
  
              // insert new user with the hashed password
              const sqlinsert = `INSERT INTO user (user_id, first_name, last_name, username, email, password)
                VALUES (NULL, ?, ?, ?, ?, ?);`;
  
              connection.query(sqlinsert, [firstname, lastname, username, email, hashedPassword], (err, data) => {
                if (err) throw err;
  
                // start a new session for the user
                let sessionObj = req.session;
                req.session.sessValid = true;
  
                res.redirect('/login/?m=Registration Successful');
              });
            });
          });
        }
      });
      // error management in case there are other issues whilst trying to register
    } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
    }
  });
  
// app.post to allow users to update their collection title
app.post('/edit_title', (req, res) => {
    // variables to capture the form inputs
    let new_title = req.body.new_title_field;
    let old_title_id = req.body.original_id_field;

    let sqlinsert = `UPDATE collection SET collection_name = ? WHERE collection_id = ?;`;
    
    connection.query(sqlinsert, [new_title, old_title_id], (err, data) => {
        if (err) throw err;

        res.redirect('/mycollections');
    });
});

// app.post to allow users to edit the description for their collections
app.post('/edit_desc', (req, res) => {
    // variables capturing the form inputs
    let new_desc = req.body.new_desc_field;
    let collection_id = req.body.original_id_field;

    let sqlinsert = `UPDATE collection SET collection_desc = ? WHERE collection_id = ?;`;
    
    connection.query(sqlinsert, [new_desc, collection_id], (err, data) => {
        if (err) throw err;
        
        res.redirect('/mycollections');
    });
});

// app.get to render the login page
app.get("/login", function (req, res) {
    let message = req.query.m;
    res.render('login', {m: message});
});

  
  app.post('/login', (req, res) => {
    // variables to capture the login input
    const username = req.body.usernameField;
    const plaintextPassword = req.body.passwordField;
    
    const sqlSelect = 'SELECT * FROM user WHERE username = ?';
      
    connection.query(sqlSelect, [username], (err, rows) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Server error');
      }
    
      if (rows.length === 0) {
        // no user found with given username
        return res.redirect('/login?m=Incorrect%20Username');
      }
    
      const hashedPassword = rows[0].password;
    
      bcrypt.compare(plaintextPassword, hashedPassword, (err, passwordMatches) => {
        if (err) {
          console.error(err);
          return res.status(500).send('Server error');
        }
    
        if (passwordMatches) {
          // passwords match, start session and redirect to home page
          let sessionObj = req.session;  
          sessionObj.user_id = rows[0].user_id;
          sessionObj.sessValid = true;
          return res.redirect('/home');
        } else {
          // passwords don't match
          return res.redirect('/login?m=Incorrect%20Password');
        }
      });
    });
  });
  
  
  
// app.get route to end the session if a user chooses to logout, will redirect to login page
app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/login");
});