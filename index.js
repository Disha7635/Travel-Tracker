import express from "express";
import bodyParser from "body-parser";
import pg from "pg"
import env from "dotenv"

//sol2 where add button adds visited countries and they are showed on map and it keeps the countries in a list forever as it is a tracker
const app = express();
const port = 3000;
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
db.connect();
async function mark_visited(){
const res=await db.query("SELECT country_code from visited_countries");
let visited=[];
    res.rows.forEach((country)=>{
      visited.push(country.country_code);
    })
  console.log(visited);
  return visited;
}
app.get("/",async (req,res)=>{
  let countries=await mark_visited();
  console.log(countries);
  console.log(JSON.stringify(countries));
res.render("index.ejs",{countries:countries,total:countries.length});
})

app.post("/add",async (req,res)=>{
    let country=req.body["country"];
    try {
    const obj=await db.query("select country_code from countries where LOWER(country_name) like '%' || $1 || '%' ;",[country.toLowerCase()]);
  
    const data=obj.rows[0];
    const countrycode=data.country_code;
    try {
        await db.query("insert into visited_countries (country_code) values ($1)",[countrycode]);
    res.redirect("/"); 
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