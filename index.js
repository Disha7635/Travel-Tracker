import express from "express";
import bodyParser from "body-parser";
import pg from "pg"
import env from "dotenv"
import bcrypt from "bcrypt";
import session from "express-session";
import passport from "passport"
import { Strategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth2";

//sol2 where add button adds visited countries and they are showed on map and it keeps the countries in a list forever as it is a tracker
const app = express();
const port = 3000;
const saltRounds=10;
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));
env.config();
const db=new pg.Client({
  user:process.env.DB_USER,
  host:process.env.DB_HOST,
  database:process.env.DB_DATABASE,
  password:process.env.DB_PASSWORD,
  port:process.env.DB_PORT
})
// const db = new pg.Client({
//   connectionString: process.env.DATABASE_URL, 
//   ssl: {
//     require: true, 
//     rejectUnauthorized: false 
//   }
// });
db.connect();
app.use(
  session({
  secret:process.env.SESSION_SECRET,
  resave: false, //for saving session in postgres database
  saveUninitialized: true,
  cookie:{
    maxAge:1000*60*60
  }
}))

app.use(passport.initialize());
app.use(passport.session());

async function mark_visited() {
const res=await db.query("SELECT country_code from visited_countries");
let visited=[];
    res.rows.forEach((country)=>{
      visited.push(country.country_code);
    })
  console.log(visited);
  return visited;
}

app.get("/", (req, res) => {
  res.render("home.ejs");
});

app.get("/login", (req, res) => {
  res.render("login.ejs");
});

app.get("/register", (req, res) => {
  res.render("register.ejs");
});

app.get("/tracker",async (req,res)=>{
  if(req.isAuthenticated()) {
  let countries=await mark_visited();
  console.log(countries);
  console.log(JSON.stringify(countries));
  res.render("index.ejs",{countries:countries,total:countries.length});
  }
  else
  res.render("/login");
})

app.get("/auth/google",passport.authenticate("google",
{
  scope:["profile","email"]
}
))

app.get("/auth/google/tracker",passport.authenticate("google",{
successRedirect:"/tracker",
failureRedirect:"/login",
}))

app.get("/logout",(req,res)=>{
  req.logout((err)=>{
    if(err) console.log(err)
    res.redirect("/");
  })
})


app.post("/register", async (req, res) => {
  let email=req.body['username'];
  let password=req.body['password'];
  try {
  const checkmail=await db.query("select * from users where email=($1)",[email]);
  if(checkmail.rows.length>0) {
    res.send("User already registered !! Please try logging in");
  }
  else {
  bcrypt.hash(password,saltRounds,async (err,hash)=>{
     if(err)
     console.log(err);
    else {
      const info=await db.query("insert into users(email,password) values($1,$2) returning *",[email,hash]);
      const user=info.rows[0];
      req.logIn(user,(err)=>{
        console.log(err);
        res.redirect("/tracker");
      })
    }
  }) 
  }
} catch(err) {
  console.log(err);
}
});

app.post("/login", passport.authenticate("local",{
      successRedirect:"/tracker",
      failureRedirect:"/login",
})
)

passport.use("local",new Strategy(async function verify(username,password,cb) {
  try {
    const check=await db.query("select * from users where email=($1)",[username]);
    if(check.rows.length>0) {
      const user=check.rows[0];
      const storedpassword=check.rows[0].password;
      bcrypt.compare(password,storedpassword,(err,result)=>{
      if(err)
        return cb(err)
      else {
        if(result)
        return cb(null,user);
        else
        return cb(null, false);
      }
      })
      
    }
    else
    return cb("User not found")
    }
    catch(err) {
      console.log(err);
    }
}))  //cb-callback

passport.use("google",
new GoogleStrategy({
  clientID: process.env.GOOGLE_CLIENTID,
  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  callbackURL: "http://localhost:3000/auth/google/tracker",
  userProfileURL: "https://www.googleapis.com/oauth2/v3/userinfo",

}, async(accessToken, refreshToken, profile, cb)=> {
console.log(profile);
try {
  let result=await db.query("select * from users where email=$1",[profile.email])
  if(result.rows.length===0) {
    const newUser= await db.query("insert into users(email,password) values ($1,$2)",[profile.email,"google"])
    cb(null,newUser.rows[0]);
  } 
  else {
    cb(null,result.rows[0]);
  }
}
catch(err) {
  cb(err);
}
}
))

passport.serializeUser((user,cb)=>{
  cb(null,user);
})
passport.deserializeUser((user,cb)=>{
  cb(null,user);
})
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});


app.post("/add",async (req,res)=>{
    let country=req.body["country"];
    try {
    const obj=await db.query("select country_code from countries where LOWER(country_name) like '%' || $1 || '%' ;",[country.toLowerCase()]);
  
    const data=obj.rows[0];
    const countrycode=data.country_code;
    try {
        await db.query("insert into visited_countries (country_code) values ($1)",[countrycode]);
    res.redirect("/tracker"); 
  }
  catch(err) {
    console.log(err);
    const Countries=await mark_visited();
    res.render("index.ejs",{
      countries:Countries,
      total: countries.length,
      error:"Country has already been added, try again.",
    })
  }
    }
    catch(err) {
      console.log(err);
      const countries= await mark_visited();
      res.render("index.ejs",{
      countries:countries,
      total: countries.length,
      error:"Country does not exist, try again.",
      })
    }
})

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});