// app.js
import React, { useState } from 'react';
import Index from './components/index';
import Navbar from './components/navbar';
import Home from './components/Home';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  return (
    <div>
      {!isAuthenticated ? (
        <Index setIsAuthenticated={setIsAuthenticated} />
      ) : (
        <>
          <Navbar />
          <Home />
        </>
      )}
    </div>
  );
}

export default App;