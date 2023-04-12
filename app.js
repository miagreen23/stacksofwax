const express = require("express");
let app = express();
const path = require("path");
const mysql = require('mysql');
const url = require('url');

app.use(express.static(path.join(__dirname,'./public')));
app.set('view engine', 'ejs');
app.use(express.urlencoded({ extended: true }));

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


app.get("/", function (req, res) {

    let getid = req.query.bid;

    let read = `SELECT album_id, img_url FROM album LIMIT 9;

                SELECT album_id, album_name, artist_name, release_year, img_url FROM album WHERE album_id IN (
                    SELECT album_id FROM album_genre WHERE genre_id = 1) LIMIT 10`;

    connection.query(read, [getid, getid], (err, albumdata)=>{
        if(err) throw err;

        let top_albums = albumdata[0];
        let album_genre_id = albumdata[1];
        
        res.render('anonindex', {top_albums, album_genre_id});
    });
});

app.get("/album", function (req, res) {

    let getid = req.query.bid;

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
        WHERE album_review.album_id = ? LIMIT 3 `;
            


    connection.query(getrow, [getid, getid, getid, getid], (err, albumrow)=>{  
        if(err) throw err;

        let album_details = albumrow[0];
        let record_label_details = albumrow[1]; 
        let track_details = albumrow[2];
        let review_details = albumrow[3];
        

        res.render('album', {album_details, record_label_details, track_details, review_details});
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



    let sqlinsert = `INSERT INTO review (review_id, user_id, rating, title, comment, date_posted)
    VALUES (NULL, '1', "${rating}", "${title}", "${comment}", "${current_date}");

    SET @last_id_in_review = LAST_INSERT_ID();
    
    INSERT INTO album_review (album_review_id, review_id, album_id) VALUES (NULL, @last_id_in_review, "${album_id}");`;

    
    connection.query(sqlinsert, (err, data) => {
        if (err) throw err;

        res.redirect(`/album?bid=${album_id}`);
        res.render('Review Posted');
    });
});


app.get("/allalbums", function (req, res) {
    let getid = req.query.bid;

    let read = `SELECT album.album_id, album.album_name, album.artist_name,
    album.release_year, album.img_url FROM album`;


    connection.query(read, [getid], (err, albumrow)=>{  
        if(err) throw err;

        let album_details = albumrow[0];
        

        res.render('all_albums', {album_details});
    });

    
});


app.get("/allcollections", function (req, res) {

    let getid = req.query.cid;

    let read = `SELECT c.collection_id, c.collection_name, c.collection_desc, u.username, g.genre_type
    FROM collection c
    INNER JOIN user u ON c.user_id = u.user_id
    INNER JOIN album_collection ac ON c.collection_id = ac.collection_id
    INNER JOIN genre g ON c.main_genre_id = g.genre_id
    GROUP BY c.collection_id;
                
                SELECT genre_type FROM genre WHERE genre_ID IN (
                    SELECT genre_ID FROM album_genre WHERE album_id IN (
                        SELECT album_ID FROM album_collection WHERE collection_id = ?))`;

    connection.query(read, [getid, getid], (err, data)=>{
        if(err) throw err;

        let collection_data = data[0];
        let genre_type = data[1];
        
        res.render('all_collections', {collection_data, genre_type});
    });
    
});

app.get("/register", function (req, res) {
    res.render('register');
});

app.get("/login", function (req, res) {
    res.render('login');
});


app.listen(process.env.PORT || 3000);
console.log('Server is listening at https://localhost:3000/');