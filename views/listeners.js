// Get the submit icon element
const addIcon = document.getElementById('add_to_collection_icon');

// Add a click event listener to the submit icon
addIcon.addEventListener('click', () => {
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
    
});
