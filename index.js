const speakeasy = require('speakeasy');
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const app = express();
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
dotenv.config();

const port = process.env.PORT;

app.use(cors());
app.use(bodyParser.json({ limit: '50mb' })); 

app.listen(port, ()=>{
    console.log('Server running...');
})

const db = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DATABASE,
    port: process.env.DBPORT
});

db.on('error', (err)=>{
    console.log("DB Connection failed, \nError: " + err);
})
db.on('connect', (stream)=>{
    console.log('DB connected!');
})


// generating secret key

function generateKey(size = 32) {
    const secret = speakeasy.generateSecret({ length: size });

    const code = speakeasy.totp({
        secret: secret.base32,
        encoding: 'base32'
    });

    return secret.base32;
}



// routes
// ---- getting data --------

app.get('/', (req, res)=>{
    res.json({msg: 'Yay!!! Db is active'})
})

// notification setting
function notifyThis(notif){
    db.query(`INSERT INTO notifications(details) VALUES('${notif}')`);
}

function historyThis(details){
    db.query(`INSERT INTO history(details) VALUES('${details}')`);
}
// fetch user data
app.get('/users/view', (req, res)=>{

    const sql = "SELECT * FROM users";
    db.query(sql, (err, data)=>{
        if (err) return console.log("\nFailed to fetch user data \nError: " + err.sqlMessage);
        res.json({ status: 200, cont: data})
        // console.log('\n Fetched user Data on ' + now)
    })
})

// login auth
app.post('/users/login', (req, res)=>{
    let date = new Date();
    let now = date.getDate() + '/' + date.getMonth() + '/' + date.getFullYear() + '  '  + date.getHours() + ':' + date.getMinutes(); 

    
    let uname = req.body.username;
    let pswd = req.body.pswd;
            // res.json({uname: uname, pswd: pswd});

    const sql = "SELECT * FROM users WHERE username = ? AND pswd = ?";
    db.query(sql, [uname, pswd], (err, results)=>{
        if (err) return console.log('\n\nOperation failed. Data came in very bad');
        
        if (results.length>0){
            notifyThis(`Access granted into the system at ${now}`);
            db.query('UPDATE users SET lastLogin = CURRENT_TIMESTAMP()');
            
            res.json({status: 202, msg: "Access granted", timestamp: now, key: generateKey()});
        }else{
            res.json({status: 403, msg: "Incorrect credentials"});
        }

    })
})


// update user info
app.post('/users/update', (req, res)=>{
    let date = new Date();
    let now = date.getDate() + '/' + date.getMonth() + '/' + date.getFullYear() + '  '  + date.getHours() + ':' + date.getMinutes(); 

    let category = req.query.category;

    if (category == "personal"){
        let fname = req.body.fname;
        let lname = req.body.lname;
        let email = req.body.email;
        let phone = req.body.phone;
        let address = req.body.address;

        const sql = "UPDATE users SET fname = ? , lname = ? , email = ? , phone = ? , address = ?";
        db.query(sql, [fname, lname, email, phone, address], (err, results)=>{
            if (err) return res.json({status: 403, msg: "Failed to update data"});
            notifyThis(`Updated personal information at ${now}`)
            res.json({status: 200, msg: "Personale information updated"});
        })
    }
    if (category == "pswd"){
        let pswd = req.body.pswd;

        const sql = "UPDATE users SET pswd = ?";
        db.query(sql, [pswd], (err, results)=>{
            if (err) return res.json({status: 403, msg: "Failed to update password"});
            notifyThis(`password changed at ${now}`)
            res.json({status: 200, msg: "Password changed"});
        })
    }

    if (category == "profile"){
        let profile = req.body.profile;
        
        const sql = "UPDATE users SET profile = ?";
        db.query(sql, [profile], (err, results)=>{
            if (err) return console.log('Failed to upload profile pic \nError', err.sqlMessage);
            notifyThis(`Profile picture changed at ${now}`)
            res.json({status: 200, msg: "Profile picture changed"});
        })
    }
})


// fetch history data
app.get('/report/view', (req, res)=>{
    let date = new Date();
    let now = date.getDate() + '/' + date.getMonth() + '/' + date.getFullYear() + '  '  + date.getHours() + ':' + date.getMinutes(); 

    const sql = "SELECT * FROM history";
    db.query(sql, (err, data)=>{
        if (err) return console.log("\nFailed to fetch report data \nError: " + err);
        res.json({ status: 200, cont: data})
        // console.log('\n Fetched history Data on ' + now)
    })
})

// Insert history data
app.post('/report/new', (req, res)=>{
    let date = new Date();
    let now = date.getDate() + '/' + date.getMonth() + '/' + date.getFullYear() + '  '  + date.getHours() + ':' + date.getMinutes(); 

    
    let details = req.body.details;
    let location = req.body.location;

    const sql = "INSERT INTO history(details, location) VALUES(? , ?)";
    db.query(sql, [details, location], (err, results)=>{
        if (err) return console.log('\n\nFailed to save report');
        res.json({status: 200, msg: "History saved"})

    })
})

// Insert history data
app.get('/report/delete', (req, res)=>{
    // console.log('hihi')
    let id = req.query.id;
    const sql = "DELETE FROM history WHERE id = ?";
    db.query(sql, [id], (err, results)=>{
        if (err) return res.json({status: 403, msg: "unable to delete data, error in sql: "+err.sqlMessage});
        res.json({status: 200, msg: "History Deleted"})

    })
})

// fetch history data
app.get('/settings/view', (req, res)=>{
    const sql = "SELECT * FROM settings";
    db.query(sql, (err, data)=>{
        if (err) return console.log("\nFailed to fetch settings data \nError: " + err.sqlMessage);
        res.json(data[0])
        console.log('\n Settings revealed')
    })
})

// update push notifications
app.get('/settings/notification', (req, res)=>{
    const opt = req.query.option;

    const sql = `UPDATE settings SET push_notifications='${opt}'`;
    db.query(sql, (err, data)=>{
        if (err) return console.log("\nFailed to update push notification \nError: " + err.sqlMessage);
        res.json({status: 200, msg: "Push notification changed"});
        console.log('\n Push notification changed')
    })
})

// update push notifications
app.get('/settings/notification/reset', (req, res)=>{

    const sql = 'DELETE FROM notifications';
    db.query(sql, (err, data)=>{
        if (err) return console.log("\nFailed to delete notification \nError: " + err.sqlMessage);
        res.json({status: 200, msg: "All notifications deleted"});
        console.log('\n Notifications deleted')
    })
})

// Delete all messages
app.get('/settings/delete/report', (req, res)=>{

    const sql = `DELETE FROM history`;
    db.query(sql, (err, data)=>{
        if (err) return console.log("\nFailed to Delete all history \nError: " + err.sqlMessage);
        notifyThis('All history details are deleted');
        res.json({status: 200, msg: "All history details deleted"});
        console.log('\n All history details deleted')
    })
})

// fetch notifications
app.get('/notifications/view', (req, res)=>{
    
    const sql = "SELECT * FROM notifications ORDER BY date DESC";
    db.query(sql, (err, data)=>{
        if (err) return console.log("\nFailed to fetch Notifications \nError: " + err.sqlMessage);
        res.json({ status: 200, cont: data})
        // console.log('\n Fetched notifications')
    })
})

// fetch Tracking
app.get('/tracking/view', (req, res)=>{
    
    const sql = "SELECT * FROM tracking";
    db.query(sql, (err, data)=>{
        if (err) return console.log("\nFailed to fetch tracking information \nError: " + err.sqlMessage);
        res.json({ status: 200, cont: data})
        console.log('\n Fetched tracking information')
    })
})

// briefcase status
app.get('/tracking/status', (req, res)=>{

    let id = req.query.id;
    
    const sql = "SELECT status FROM tracking WHERE id = ? ORDER BY date DESC";
    db.query(sql, (err, [id], data)=>{
        if (err) return console.log("\nFailed to located cattle with id " + id + " status \nError: " + err.sqlMessage);
        res.json({ status: 200, cont: data})
    })
})

// Board inserting data
app.post('/tracking/insert', (req, res)=>{
    
    let status = req.body.status;

    const sql = "INSERT INTO tracking(latitude, longitude, status) VALUES(? , ? , ?)";
    db.query(sql, ['-1.943487687631956', '30.06542407103269', status] , (err, data)=>{
        if (err) return res.json({ status: 400, msg:"\nFailed to fetch briefcase status \nError: " + err.sqlMessage});
        res.json({ status: 200, cont: "Data inserted successfully"});
    })
})


// view cattle
app.get('/cattle/view', (req, res)=>{
    
    const sql = "SELECT * FROM cattle";
    db.query(sql, (err, data)=>{
        if (err) return res.json({status: 400, msg: "Failed to fetch all cattle"});
        res.json(data)            
    })
})

// single cattle status
app.get('/cattle/status', (req, res)=>{

    let id = req.query.id;     
    
    const sql = "SELECT temperature, co2, ammonia FROM tracking WHERE cattle = ?";
    db.query(sql, [id] , (err, data)=>{
        if (err) return res.json({status: 400, msg: "Failed to cattle status"});
        res.json(data)            
    })
})

app.post('/cattle/new', (req, res)=>{
    let cattle_id = req.body.id;
    let cattle_name = req.body.cattle_name;
    let img = req.body.cattle_img;

    const sql = "INSERT INTO cattle(cattle_id, cattle_name, cattle_img) VALUES (? , ? , ?)";
    db.query(sql, [cattle_id, cattle_name, img], (err, data)=>{
        if (err) return res.json({status: 400, msg: "Failed to add new cattle to DB"});
        historyThis("A New cattle has been added to the cowshed (Name: "+cattle_name+" |  Id: "+ cattle_id +")")
        res.json({status: 200, msg: "New Cattle Added"})
    })
})

// cattle tracking
app.get('/cattle/track', (req, res)=>{
    let id = req.query.id;

    let sql;

    if (id){
        sql = `SELECT * FROM tracking WHERE cattle='${sql}'`;
    }else{
        sql = "SELECT * FROM tracking";
    }
    db.query(sql, (err, data)=>{
        if (err) return res.json({status: 400, msg: "Failed to fetch cattle stats"});
        res.json(data)            
    })
})