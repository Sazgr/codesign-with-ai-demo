import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import BeerGame from './beergame/BeerGame'
import McdonaldsGame from './mcdonaldsgame/McdonaldsGame'
import NvidiaGame from './nvidiagame/NvidiaGame'

function App() {
  // This "state" keeps track of which component is currently visible
  const [activeView, setActiveView] = useState('intro');

  // Logic to decide what to show on the right side
  const renderMainContent = () => {
    switch (activeView) {
      case 'intro':
        return <Introduction />;
	  case 'beer':
        return <BeerGame />;
      case 'game2':
        return <McdonaldsGame />;
      case 'game3':
        return <NvidiaGame />;
      default:
        return <Introduction />;
    }
  };

  const SIDEBAR_TEXT = {
    header: "Project Overview",
    generalDescription: "This platform hosts AI-generated simulations adapted from the Beer Game to visualize complex supply chain systems.",
    gameDetails: {
	  intro: "Overview and instructions on using this platform.",
      beer: "A supply chain simulation demonstrating the bullwhip effect and inventory management.",
      game2: "Take on the role as Martin Bower's Regional DC Manager and coordinate replenishment efforts to ensure minimal inventory and backlog.",
      game3: "Take on the role as NVIDIA's Procurement Manager and coordinate replenishment efforts to ensure minimal inventory and backlog."
    }
  };
  
 const Introduction = ({ apiKey, onSetKey }) => {
  return (
    <div style={{ ...styles.content, padding: '40px' }}>
      <div style={{ maxWidth: '900px', margin: '0 auto' }}>
        
        {/* Header Section */}
        <div style={{ marginBottom: '40px' }}>
          <h1 style={{ ...styles.title, fontSize: '2.5rem', marginBottom: '10px' }}>
            Co-Designing with AI
          </h1>
          <p style={{ ...styles.descriptionText, fontSize: '1.2rem', color: '#3498db' }}>
            Build industrial simulations tailored to your company.
          </p>
        </div>

        {/* Instructions & How to Use */}
        <div style={styles.generalBox}>
          <h3 style={styles.subTitle}>Instructions</h3>
          <p style={styles.descriptionText}>
            This demonstration platform showcases the final outputs of Co-Designing with AI, 
            using industry-adapted simulations derived from the classic Beer Game supply-chain model.
          </p>
          
          <div style={{ ...styles.dynamicBox, marginTop: '20px' }}>
            <h4 style={{ ...styles.subTitle, color: '#f8fafc' }}>How to Use the Demo</h4>
            <ul style={{ ...styles.descriptionText, paddingLeft: '20px', marginTop: '10px' }}>
              <li><strong>Select a simulation</strong> using the side tabs: Beer Game, Fast Food Industry, or Semiconductor Industry.</li>
              <li><strong>Choose the control mode</strong> for each role (Player or AI).</li>
              <li><strong>Run the simulation</strong> to explore system behavior under different configurations.</li>
            </ul>
            <p style={{ ...styles.descriptionText, marginTop: '15px', fontSize: '0.85rem', fontStyle: 'italic' }}>
              *For industry-specific simulations, only the Regional Distribution Center Manager role is user-controlled. 
              Other roles are operated by Agentic AI.
            </p>
          </div>
        </div>

        {/* System Connection Section */}
        <div style={{ ...styles.dynamicBox, borderLeftColor: '#e74c3c', marginBottom: '40px' }}>
          <h3 style={styles.subTitle}>System Connection (Under Construction)</h3>
          {apiKey ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <p style={{ ...styles.dynamicText, color: '#4ade80', fontWeight: 'bold' }}>
                ✅ AI Engine Connected
              </p>
              <button onClick={onSetKey} style={{ ...styles.btn, padding: '4px 10px', fontSize: '0.75rem' }}>
                Update Key
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <p style={styles.dynamicText}>To enable Agentic AI roles, please provide a Gemini API Key.</p>
              <button onClick={onSetKey} style={styles.activeBtn}>Enter API Key</button>
            </div>
          )}
        </div>

        {/* Background & Approach */}
        <div style={styles.generalBox}>
          <h3 style={styles.subTitle}>Background</h3>
          <p style={styles.descriptionText}>
            Complex systems are difficult to design, test, and scale. Traditional models rely on fixed assumptions, 
            static rules, and slow development cycles, making it hard to explore uncertainty, anticipate change, 
            or evaluate downstream impacts before deployment.
          </p>
        </div>

        <div style={styles.generalBox}>
          <h3 style={styles.subTitle}>The Approach</h3>
          <p style={{ ...styles.descriptionText, marginBottom: '15px' }}>
            Co-Designing with AI enables rapid transformation of system concepts into executable simulations, 
            leveraging industry-specific ontologies to ensure system logic consistency.
          </p>
          <p style={styles.descriptionText}>
            Our <strong>Create-Orchestrate-Deploy-Expand (CODE)</strong> framework refines the one-shot prompt 
            engineering technique for recreating game mechanics and leverages industry-specific ontologies to mitigate 
            hallucination. Agentic AI is integrated to shift the simulation from a hot-seat multiplayer style to a 
            role-specific training simulation.
          </p>
        </div>

        {/* Demo Details */}
        <div style={styles.generalBox}>
          <h3 style={styles.subTitle}>Demo Capabilities</h3>
          <ul style={{ ...styles.descriptionText, paddingLeft: '20px' }}>
            <li>Simulate industry supply chains in Semiconductors and Fast Food</li>
            <li>Multiple modes: collaborative game, role-based training, or Agentic AI-driven simulation</li>
            <li>Adjust parameters, constraints, and scenarios in real time</li>
            <li>Observe system behavior and emergent outcomes</li>
          </ul>
        </div>

        {/* Impact Section */}
        <div style={{ marginBottom: '40px' }}>
          <h3 style={styles.subTitle}>Impact</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginTop: '10px' }}>
            <div style={{ ...styles.dynamicBox, marginBottom: 0 }}>
              <p style={styles.dynamicText}>Rapid, resource-light system modeling at scale.</p>
            </div>
            <div style={{ ...styles.dynamicBox, marginBottom: 0 }}>
              <p style={styles.dynamicText}>Cross-industry simulations beyond supply chains.</p>
            </div>
            <div style={{ ...styles.dynamicBox, marginBottom: 0 }}>
              <p style={styles.dynamicText}>Fast scenario testing to reveal risks and bottlenecks.</p>
            </div>
            <div style={{ ...styles.dynamicBox, marginBottom: 0 }}>
              <p style={styles.dynamicText}>Decision-ready insights before real-world deployment.</p>
            </div>
          </div>
        </div>

        {/* Notes Footer */}
        <div style={{ padding: '20px', borderTop: '1px solid #334155' }}>
          <p style={{ ...styles.descriptionText, fontSize: '0.8rem', opacity: 0.6 }}>
            <strong>Notes:</strong> This platform represents a raw, auto-generated prototype. Minor bugs or 
            interface misalignments may be present. Best viewed on a PC for optimal interaction.
          </p>
        </div>

      </div>
    </div>
  );
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
		  onClick={() => setActiveView('intro')}
		  style={activeView === 'intro' ? styles.activeBtn : styles.btn}
		>
		  Introduction
		</button>
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
          Industry - Fast Food
        </button>
        <button 
          onClick={() => setActiveView('game3')} 
          style={activeView === 'game3' ? styles.activeBtn : styles.btn}
        >
          Industry - Semiconductor
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