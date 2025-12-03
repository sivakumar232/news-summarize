const express=require("express")
const app=express()
const cors=require("cors")
const port =3000;
app.get("/",(req,res)=>{
    res.send("server is running")
})
app.post("/getnews",(req,res)=>{
    const usersearch=req.body.usersearch;
    console.log(usersearch) 
})
app.listen(port,()=>{
 console.log("server is running")   
})