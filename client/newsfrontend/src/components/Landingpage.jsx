import React, { useState, useCallback } from 'react';
import axios from 'axios';
import { Search, Globe, ChevronRight } from 'lucide-react';

// NOTE: We assume the backend is running at this address.
const API_URL = 'http://localhost:3000/search?query=bitcoin';

const Landingpage = () => {
    // State for user input
    const [search, setSearch] = useState('');
    // State for storing the scraped results
    const [newsResults, setNewsResults] = useState([]);
    // State for loading indicator
    const [isLoading, setIsLoading] = useState(false);
    // State for error messages
    const [error, setError] = useState(null);

    // Function to handle the form submission and API call
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();

        // Basic validation
        if (!search.trim()) {
            setError('Please enter a search term.');
            setNewsResults([]);
            return;
        }

        setError(null);
        setIsLoading(true);
        setNewsResults([]);

        try {
            // 1. Correct the request: Use GET and encode the term for the query parameter
            const encodedSearchTerm = encodeURIComponent(search.trim());
            const url = `${API_URL}?usersearch=${encodedSearchTerm}`;

            const res = await axios.get(url);
            
            // Check if the server returned results
            if (res.data && res.data.data && res.data.data.results) {
                setNewsResults(res.data.data.results);
            } else {
                setNewsResults([]);
                setError('Search completed, but no articles were found.');
            }

        } catch (err) {
            console.error("Error occurred while fetching news:", err);
            
            // Handle server/network errors gracefully
            if (err.response) {
                // The server responded with a non-2xx status code
                setError(`API Error (${err.response.status}): ${err.response.data.error || 'Check server console.'}`);
            } else if (err.request) {
                // The request was made but no response was received
                setError('Network Error: Could not connect to the backend server (Is it running?).');
            } else {
                setError('An unexpected error occurred during the request setup.');
            }
        } finally {
            setIsLoading(false);
        }
    }, [search]);

    return (
        <div className='p-8 min-h-screen bg-gray-50 flex flex-col items-center'>
            <header className='w-full max-w-4xl text-center py-6'>
                <h1 className='text-4xl font-extrabold text-blue-700 tracking-tight flex items-center justify-center'>
                    <Globe className='w-8 h-8 mr-3'/> News Scraper Frontend
                </h1>
                <p className='text-gray-600 mt-2'>Search, Scrape, and Summarize News Articles</p>
            </header>

            {/* Search Form (Attached handleSubmit to the form) */}
            <form onSubmit={handleSubmit} className='w-full max-w-xl mb-8 shadow-lg rounded-xl overflow-hidden bg-white'>
                <div className='flex p-1 border-2 border-blue-500 rounded-xl'>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className='flex-grow px-4 py-2 outline-none placeholder-gray-400 text-gray-800'
                        placeholder='Enter topic (e.g., "SpaceX Starship" or "Local Elections")'
                        disabled={isLoading}
                    />
                    <button
                        type='submit'
                        className='bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 flex items-center rounded-lg disabled:opacity-50 transition duration-150'
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                        ) : (
                            <Search className='w-5 h-5 mr-2'/>
                        )}
                        {isLoading ? 'Searching...' : 'Search'}
                    </button>
                </div>
            </form>

            {/* Output Section */}
            <main className='w-full max-w-4xl'>
                {/* Error Message Display */}
                {error && (
                    <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-xl mb-6 shadow-md' role="alert">
                        <strong className="font-bold">Error! </strong>
                        <span className="block sm:inline">{error}</span>
                    </div>
                )}
                
                {/* Results Display */}
                {!isLoading && newsResults.length > 0 && (
                    <div className='space-y-4'>
                        <h2 className='text-xl font-semibold text-gray-700 mb-4 border-b pb-2'>
                            {newsResults.length} Results Found
                        </h2>
                        {newsResults.map((article, index) => (
                            <a 
                                key={index} 
                                href={article.link} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className='block bg-white p-5 rounded-xl shadow-md hover:shadow-lg transition duration-200 border border-gray-200'
                            >
                                <h3 className='text-lg font-bold text-blue-600 mb-1'>{article.title}</h3>
                                <p className='text-sm text-gray-600 mb-3'>{article.snippet}</p>
                                <div className='flex items-center text-xs text-blue-500'>
                                    <span>{article.link}</span>
                                    <ChevronRight className='w-4 h-4 ml-1'/>
                                </div>
                            </a>
                        ))}
                    </div>
                )}
                
                {!isLoading && !error && newsResults.length === 0 && search && (
                    <p className='text-center text-gray-500 mt-10 p-6 bg-white rounded-xl shadow-md'>
                        No results to display yet. Enter a search term above and click Search.
                    </p>
                )}
            </main>
        </div>
    );
}

export default Landingpage;