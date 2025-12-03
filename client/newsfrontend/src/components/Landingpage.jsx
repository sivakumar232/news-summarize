import React from 'react'
import { useEffect } from 'react'
import { useState } from 'react'
import axios from 'axios'
const Landingpage = () => {
    const [search,setSearch]=useState('')
    const handlesubmit=(e)=>{
        e.preventDefault();
        useEffect(()=>{
            axios.post("http://localhost:3000/getnews",{
                usersearch:search
            })
        })
    }
  return (
    <div className='flex flex-col p-6  items-center  h-screen'>
                <h1>Search news and get summary</h1>
    <div className='flex  justify-center items-center'>
        <input type="text" value={search} onChange={(e)=>setSearch(e.target.value)} className='border border-black rounded-l pl-4 outline-none placeholder-gray-500 cursor:text h-10 w-180 cursor' placeholder='Search here ' />
        <button type='submit' className='bg-blue-500  hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-r'  onClick={handlesubmit}>Search</button>
    </div>
    </div>
  )
}

export default Landingpage