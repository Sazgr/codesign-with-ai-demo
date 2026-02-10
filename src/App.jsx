import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import BeerGame from './beergame/BeerGame'
import McdonaldsGame from './mcdonaldsgame/McdonaldsGame'
import NvidiaGame from './nvidiagame/NvidiaGame'

function App() {
  // This "state" keeps track of which component is currently visible
  const [activeView, setActiveView] = useState('beer');

  // Logic to decide what to show on the right side
  const renderMainContent = () => {
    switch (activeView) {
      case 'beer':
        return <BeerGame />;
      case 'game2':
        return <McdonaldsGame />;
      case 'game3':
        return <NvidiaGame />;
      default:
        return <BeerGame />;
    }
  };

  const SIDEBAR_TEXT = {
    header: "Project Overview",
    generalDescription: "This platform hosts interactive simulations designed to visualize complex systems like supply chains and economic models.",
    gameDetails: {
      beer: "A supply chain simulation demonstrating the bullwhip effect and inventory management.",
      game2: "An interactive model exploring market dynamics and equilibrium points.",
      game3: "A custom simulation for testing logistics and distribution strategies."
    }
  };

  return (
    <div style={styles.container}>
      {/* LEFT SIDEBAR */}
      <nav style={styles.sidebar}>
        <h2 style={styles.title}>Menu</h2>
		
		{/* GENERAL DESCRIPTION */}
	    <div style={styles.generalBox}>
	  	  <h3 style={styles.subTitle}>{SIDEBAR_TEXT.header}</h3>
		  <p style={styles.descriptionText}>{SIDEBAR_TEXT.generalDescription}</p>
	    </div>

	    {/* DYNAMIC GAME DESCRIPTION */}
	    <div style={styles.dynamicBox}>
		  <p style={styles.dynamicText}>
		    <strong>Current View:</strong> {SIDEBAR_TEXT.gameDetails[activeView]}
		  </p>
	    </div>
        <button 
          onClick={() => setActiveView('beer')} 
          style={activeView === 'beer' ? styles.activeBtn : styles.btn}
        >
          Beer Game
        </button>
        <button 
          onClick={() => setActiveView('game2')} 
          style={activeView === 'game2' ? styles.activeBtn : styles.btn}
        >
          Second Game
        </button>
        <button 
          onClick={() => setActiveView('game3')} 
          style={activeView === 'game3' ? styles.activeBtn : styles.btn}
        >
          Third Game
        </button>
      </nav>

      {/* RIGHT CONTENT AREA */}
      <main style={styles.content}>
		<div style={{ flex: 1, width: '100%', height: '100%' }}>
		  {renderMainContent()}
		</div>
	  </main>
    </div>
  );
}

// Simple CSS-in-JS for quick setup
const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    fontFamily: 'sans-serif',
  },
  sidebar: {
    width: '300px', // Widened from 250px
    backgroundColor: '#1e293b',
    color: 'white',
    padding: '25px',
    display: 'flex',
    flexDirection: 'column',
    borderRight: '1px solid #334155',
  },
  title: {
    fontSize: '1.6rem',
    marginBottom: '15px',
    color: '#f8fafc',
  },
  subTitle: {
    fontSize: '0.85rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#94a3b8',
    marginBottom: '8px',
    marginTop: 0,
  },
  generalBox: {
    marginBottom: '20px',
    paddingBottom: '20px',
    borderBottom: '1px solid #334155',
  },
  dynamicBox: {
    backgroundColor: 'rgba(52, 152, 219, 0.1)',
    padding: '12px',
    borderRadius: '6px',
    borderLeft: '4px solid #3498db',
    marginBottom: '25px',
  },
  descriptionText: {
    fontSize: '0.9rem',
    lineHeight: '1.5',
    color: '#cbd5e1',
    margin: 0,
  },
  dynamicText: {
    fontSize: '0.85rem',
    lineHeight: '1.4',
    color: '#e2e8f0',
    margin: 0,
  },
  buttonGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  btn: {
    padding: '12px',
    textAlign: 'left',
    backgroundColor: 'transparent',
    color: '#94a3b8',
    border: '1px solid #334155',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: '0.2s',
  },
  activeBtn: {
    padding: '12px',
    textAlign: 'left',
    backgroundColor: '#3498db',
    color: 'white',
    border: '1px solid #3498db',
    borderRadius: '6px',
    cursor: 'pointer',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    height: '100vh',
    overflowY: 'auto',
    padding: '0',
    // Change this to the exact dark color used in your Beer Game
    backgroundColor: '#0f172a', 
  }
};

export default App;