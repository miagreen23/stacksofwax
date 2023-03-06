const express = require("express");
let app = express();
const path = require("path");
const mysql = require('mysql');

app.use(express.static(path.join(__dirname,'./public')));
app.set('view engine', 'ejs');

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
                    SELECT album_name, artist_name, release_year, img_url FROM album WHERE album_id IN (
                    SELECT album_id FROM album_genre WHERE genre_id = 1) LIMIT 8`;

    connection.query(read, [getid, getid], (err, albumdata)=>{
        if(err) throw err;

        let top_albums = albumdata[0];
        let album_genre_id = albumdata[1];
        
        res.render('anonindex', {top_albums, album_genre_id});
    });
});

app.get("/album", function (req, res) {

    let getid = req.query.bid;

    let getrow = ` SELECT album.album_name, album.artist_name,
                    album.release_year, album.img_url FROM album WHERE album_id = ?;
        
                    SELECT record_label_name FROM record_label WHERE record_label_id IN (
        SELECT record_label_id FROM album WHERE album_id = ?);
        
        SELECT track.track_title, track.duration, track.track_position_on_album FROM track WHERE track_id IN (
            SELECT track_id FROM track_album WHERE album_id = ?) `;


    connection.query(getrow, [getid, getid, getid], (err, albumrow)=>{  
        if(err) throw err;

        let album_details = albumrow[0];
        let record_label_details = albumrow[1];
        let track_details = albumrow[2];

        res.render('album', {album_details, record_label_details, track_details});
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