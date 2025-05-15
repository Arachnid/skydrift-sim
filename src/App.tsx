import React from 'react';
import './App.css';
import SkydriftArchipelagoSimulation from './components/simulation';

function App() {
  return (
    <div className="App">
      <header className="App-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <img 
            src={`${process.env.PUBLIC_URL}/favicon.png`} 
            alt="Skydrift Logo" 
            className="App-logo"
            style={{ marginRight: '15px' }} 
          />
          <h1>Skydrift Archipelago Simulator</h1>
        </div>
      </header>
      <main className="App-main">
        <SkydriftArchipelagoSimulation />
      </main>
    </div>
  );
}

export default App;
