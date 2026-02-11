import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Factory, Truck, Package, AlertTriangle, Cpu, TrendingUp, DollarSign, Activity, Database, Server, Info, Bot, BrainCircuit, Loader2 } from 'lucide-react';

// --- Constants & Config ---
const apiKey = ""; // USER TO FILL
const MAX_WEEKS = 20;
const LEAD_TIME = 2; // Weeks for both stages (Raw->Supplier, Supplier->NVIDIA)
const HOLDING_COST_PER_UNIT = 50; 
const BACKLOG_COST_PER_UNIT = 500; 
const INITIAL_INVENTORY = 400;
const COMPONENT_CAPACITY_PER_WEEK = 2000; // Supplier hard cap

// Simulated "Hype Cycle" Demand Curve for Blackwell
const DEMAND_SCHEDULE = [
  200, 250, 300, 400, 500, // Early ramp
  800, 1000, 1200, 1100, 900, // Peak hype / allocation wars
  800, 850, 900, 1000, 1200, // Sustained demand
  1300, 1400, 1200, 1000, 800 // Mature
];

// --- Helper Components ---

const Card = ({ children, className = "" }) => (
  <div className={`bg-neutral-900 border border-neutral-800 rounded-lg p-4 shadow-sm ${className}`}>
    {children}
  </div>
);

const Badge = ({ children, color = "green" }) => {
  const styles = {
    green: "bg-[#76B900]/20 text-[#76B900] border-[#76B900]/30",
    red: "bg-red-500/20 text-red-400 border-red-500/30",
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-mono border ${styles[color] || styles.green}`}>
      {children}
    </span>
  );
};

// --- API Logic ---

const getAITurn = async (role, week, inventory, backlog, incomingShipments, incomingDemand, recentHistory) => {
  if (!apiKey) {
    // Fallback if no API key
    console.warn("No API Key provided. Using heuristic fallback.");
    return { order: incomingDemand, reasoning: "API Key missing. Matching demand." };
  }

  const prompt = `
    You are the Supply Chain Manager for ${role} in a Beer Game simulation supplying NVIDIA.
    Current Week: ${week}.
    Your Inventory: ${inventory}.
    Your Backlog: ${backlog}.
    Incoming Demand (from NVIDIA): ${incomingDemand}.
    Incoming Shipments (arriving soon): ${JSON.stringify(incomingShipments)}.
    Recent History: ${JSON.stringify(recentHistory)}.
    
    Goal: Minimize Total Cost. Holding cost is $50/unit. Backlog cost is $500/unit.
    Constraint: Max order is ${COMPONENT_CAPACITY_PER_WEEK}.
    Instructions:
    1. Do not run out of stock (backlog is expensive).
    2. Do not hoard inventory (holding is expensive).
    3. Avoid the Bullwhip Effect: Do not panic order if you see a temporary spike, but plan for lead times (2 weeks).
    
    Output JSON ONLY: { "order": integer, "reasoning": "short string under 15 words" }
  `;

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { 
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              order: { type: "INTEGER" },
              reasoning: { type: "STRING" }
            }
          }
        }
      })
    });

    const data = await response.json();
    const result = JSON.parse(data.candidates[0].content.parts[0].text);
    // Safety clamp
    const safeOrder = Math.max(0, Math.min(result.order, COMPONENT_CAPACITY_PER_WEEK));
    return { order: safeOrder, reasoning: result.reasoning };

  } catch (error) {
    console.error("AI Error:", error);
    // Fallback: Order demand + portion of backlog
    const heuristic = incomingDemand + Math.floor(backlog * 0.5);
    return { order: heuristic, reasoning: "Connection failed. Panic ordering." };
  }
};

// --- Main Application ---

export default function BlackwellSupplyChain() {
  // --- State ---
  const [week, setWeek] = useState(1);
  const [gameState, setGameState] = useState('START'); // START, PLAY, THINKING, END
  
  // Player State (Blackwell Node)
  const [player, setPlayer] = useState({
    inventory: { cowos: INITIAL_INVENTORY, hbm: INITIAL_INVENTORY },
    backlog: 0,
    cash: 0,
    pipeline: [] // Incoming from Suppliers
  });

  // AI Suppliers State (Tier 1)
  const [suppliers, setSuppliers] = useState({
    cowos: {
      name: "TSMC (CoWoS)",
      inventory: INITIAL_INVENTORY,
      backlog: 0,
      pipeline: [], // Incoming from Raw Materials
      lastOrder: 0,
      reasoning: "Waiting for first order..."
    },
    hbm: {
      name: "SK Hynix (HBM)",
      inventory: INITIAL_INVENTORY,
      backlog: 0,
      pipeline: [], // Incoming from Raw Materials
      lastOrder: 0,
      reasoning: "Waiting for first order..."
    }
  });
  
  // Inputs
  const [orders, setOrders] = useState({ cowos: 0, hbm: 0 });
  const [errors, setErrors] = useState({ cowos: '', hbm: '' });

  // History for Charts
  const [history, setHistory] = useState([]);

  // --- Logic ---

  const validateOrder = (type, value) => {
    const val = parseInt(value) || 0;
    if (val < 0) return "Cannot order negative units.";
    if (val > COMPONENT_CAPACITY_PER_WEEK) return `Max order: ${COMPONENT_CAPACITY_PER_WEEK}`;
    return "";
  };

  const handleInputChange = (type, value) => {
    const error = validateOrder(type, value);
    setErrors(prev => ({ ...prev, [type]: error }));
    setOrders(prev => ({ ...prev, [type]: value }));
  };

  // Phase 1: Player Clicks Submit -> Trigger AI
  const handlePlayerSubmit = async () => {
    const cowosOrder = parseInt(orders.cowos) || 0;
    const hbmOrder = parseInt(orders.hbm) || 0;

    if (cowosOrder > COMPONENT_CAPACITY_PER_WEEK || hbmOrder > COMPONENT_CAPACITY_PER_WEEK) return;

    setGameState('THINKING');

    // Prepare data for AI
    const recentHistory = history.slice(-3);

    // Call Gemini for both suppliers in parallel
    const [cowosDecision, hbmDecision] = await Promise.all([
      getAITurn(
        "TSMC CoWoS Supplier", 
        week, 
        suppliers.cowos.inventory, 
        suppliers.cowos.backlog, 
        suppliers.cowos.pipeline.filter(p => p.arrivalWeek <= week + 2), 
        cowosOrder, 
        recentHistory
      ),
      getAITurn(
        "SK Hynix HBM Supplier", 
        week, 
        suppliers.hbm.inventory, 
        suppliers.hbm.backlog, 
        suppliers.hbm.pipeline.filter(p => p.arrivalWeek <= week + 2), 
        hbmOrder, 
        recentHistory
      )
    ]);

    // Proceed to process the turn with AI decisions
    finalizeTurn(cowosOrder, hbmOrder, cowosDecision, hbmDecision);
  };

  // Phase 2: Process Logistics & Advance Week
  const finalizeTurn = (playerCowosOrder, playerHbmOrder, cowosAI, hbmAI) => {
    
    // --- 1. Supplier Phase (Tier 1) ---
    // Suppliers receive shipments from Raw Materials (ordered 2 weeks ago)
    const updateSupplier = (supplierKey, playerOrder, aiDecision) => {
      const sup = suppliers[supplierKey];
      
      // Receive Raw Materials
      const arrivingRaw = sup.pipeline
        .filter(p => p.arrivalWeek === week)
        .reduce((sum, p) => sum + p.amount, 0);
      
      const availableInventory = sup.inventory + arrivingRaw;
      
      // Fulfill Player Order (Incoming Demand + Existing Backlog)
      const totalDemand = playerOrder + sup.backlog;
      const shippedToPlayer = Math.min(availableInventory, totalDemand);
      const newBacklog = totalDemand - shippedToPlayer;
      const newInventory = availableInventory - shippedToPlayer;
      
      // Place new Production Order (AI Decision)
      const newPipelineItem = { 
        arrivalWeek: week + LEAD_TIME, 
        amount: aiDecision.order 
      };

      return {
        ...sup,
        inventory: newInventory,
        backlog: newBacklog,
        pipeline: [...sup.pipeline, newPipelineItem],
        lastOrder: aiDecision.order,
        reasoning: aiDecision.reasoning,
        lastShipped: shippedToPlayer
      };
    };

    const newCowosState = updateSupplier('cowos', playerCowosOrder, cowosAI);
    const newHbmState = updateSupplier('hbm', playerHbmOrder, hbmAI);

    // --- 2. Player Phase (Tier 0) ---
    
    // Receive shipments from Suppliers (Shipments created 2 weeks ago arrive now)
    // NOTE: In Beer Game logic, what the Supplier ships *now* arrives in *2 weeks*.
    // So we add the *Supplier's Shipment* to the Player's Pipeline.
    
    // Check for arrivals in Player Pipeline
    const arrivingCowos = player.pipeline
      .filter(p => p.type === 'cowos' && p.arrivalWeek === week)
      .reduce((sum, p) => sum + p.amount, 0);
      
    const arrivingHbm = player.pipeline
      .filter(p => p.type === 'hbm' && p.arrivalWeek === week)
      .reduce((sum, p) => sum + p.amount, 0);

    const currentInventory = {
      cowos: player.inventory.cowos + arrivingCowos,
      hbm: player.inventory.hbm + arrivingHbm
    };

    // Fulfill Market Demand
    const marketDemand = DEMAND_SCHEDULE[week - 1] || 0;
    const totalPlayerDemand = marketDemand + player.backlog;
    
    // Production constrained by available components
    const maxProduction = Math.min(currentInventory.cowos, currentInventory.hbm);
    const fulfilled = Math.min(maxProduction, totalPlayerDemand);
    const newPlayerBacklog = totalPlayerDemand - fulfilled;
    
    const newPlayerInventory = {
      cowos: currentInventory.cowos - fulfilled,
      hbm: currentInventory.hbm - fulfilled
    };

    // Calculate Costs
    const holdingCost = (newPlayerInventory.cowos + newPlayerInventory.hbm) * HOLDING_COST_PER_UNIT;
    const backlogCost = newPlayerBacklog * BACKLOG_COST_PER_UNIT;
    const weeklyCost = holdingCost + backlogCost;
    const newTotalCash = player.cash + weeklyCost;

    // Add Supplier Shipments to Player Pipeline (Arrival = Current Week + Lead Time)
    const newPlayerPipeline = [
      ...player.pipeline,
      { arrivalWeek: week + LEAD_TIME, type: 'cowos', amount: newCowosState.lastShipped },
      { arrivalWeek: week + LEAD_TIME, type: 'hbm', amount: newHbmState.lastShipped }
    ];

    // --- 3. Update History & State ---
    const weekStats = {
      week,
      demand: marketDemand,
      fulfilled,
      backlog: newPlayerBacklog,
      invCowos: newPlayerInventory.cowos,
      invHbm: newPlayerInventory.hbm,
      cost: weeklyCost,
      cumCost: newTotalCash,
      aiCowosInv: newCowosState.inventory,
      aiHbmInv: newHbmState.inventory
    };

    setHistory(prev => [...prev, weekStats]);
    setPlayer({
      inventory: newPlayerInventory,
      backlog: newPlayerBacklog,
      cash: newTotalCash,
      pipeline: newPlayerPipeline
    });
    setSuppliers({
      cowos: newCowosState,
      hbm: newHbmState
    });

    if (week >= MAX_WEEKS) {
      setGameState('END');
    } else {
      setWeek(prev => prev + 1);
      setGameState('PLAY');
    }
  };

  const restartGame = () => {
    setWeek(1);
    setGameState('START');
    setPlayer({
      inventory: { cowos: INITIAL_INVENTORY, hbm: INITIAL_INVENTORY },
      backlog: 0,
      cash: 0,
      pipeline: []
    });
    setSuppliers({
      cowos: { ...suppliers.cowos, inventory: INITIAL_INVENTORY, backlog: 0, pipeline: [], reasoning: "Ready" },
      hbm: { ...suppliers.hbm, inventory: INITIAL_INVENTORY, backlog: 0, pipeline: [], reasoning: "Ready" }
    });
    setHistory([]);
    setOrders({ cowos: 0, hbm: 0 });
  };

  // --- Render ---

  if (gameState === 'START') {
    return (
      <div className="min-h-screen bg-neutral-950 text-white flex items-center justify-center p-4 font-sans">
        <div className="max-w-2xl w-full bg-neutral-900 border border-neutral-800 rounded-xl p-8 shadow-2xl">
          <div className="flex items-center gap-4 mb-6">
            <Bot className="w-12 h-12 text-[#76B900]" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Blackwell Supply Chain AI</h1>
              <p className="text-gray-500">Player vs Gemini 2.5 Agents</p>
            </div>
          </div>
          <p className="text-gray-400 mb-6 leading-relaxed">
            You play as <strong>NVIDIA</strong>. The two suppliers (CoWoS and HBM) are controlled by <strong>AI Agents</strong>.
            <br/><br/>
            You place orders to them. They decide how much to manufacture based on their own inventory and reasoning.
            <br/><br/>
            <strong>The Challenge:</strong> The AI tries to minimize its own costs. If you panic order, the AI might panic too (Bullwhip Effect). 
          </p>
          
          <div className="bg-neutral-950 p-4 rounded border border-neutral-800 mb-6">
            <h3 className="text-[#76B900] font-bold mb-2">API Configuration</h3>
            {apiKey ? (
              <div className="flex items-center gap-2 text-green-400 text-sm">
                <BrainCircuit size={16} /> Gemini API Key Detected
              </div>
            ) : (
               <div className="flex items-center gap-2 text-yellow-500 text-sm">
                <AlertTriangle size={16} /> API Key Missing (Using fallback logic)
              </div>
            )}
          </div>

          <button 
            onClick={() => setGameState('PLAY')}
            className="w-full bg-[#76B900] hover:bg-[#66a300] text-black font-bold py-4 rounded-lg transition-colors text-lg"
          >
            Start Simulation
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-gray-100 font-sans selection:bg-[#76B900] selection:text-black">
	  {/* API Key Modal if missing */}
      {!apiKey && (
        <div className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-sm text-white p-2 text-center text-xs font-bold">
           Demo Mode: AI will use fallback logic. To enable Gemini, set API_KEY in code.
        </div>
      )}
      {/* Header */}
      <header className="border-b border-neutral-800 bg-neutral-900/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-[#76B900] p-1 rounded">
              <Cpu className="w-5 h-5 text-black" />
            </div>
            <span className="font-bold text-lg tracking-tight">NVIDIA <span className="text-neutral-400 font-normal">Blackwell OPS</span></span>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <span className="text-xs text-gray-500 uppercase tracking-wider">Your Cost</span>
              <span className={`font-mono font-bold ${player.cash > 100000 ? 'text-red-500' : 'text-white'}`}>
                ${player.cash.toLocaleString()}
              </span>
            </div>
            <div className="h-8 w-px bg-neutral-800"></div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-400">Week</span>
              <span className="text-2xl font-bold text-[#76B900]">{week}</span>
              <span className="text-sm text-gray-600">/ {MAX_WEEKS}</span>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 grid grid-cols-1 lg:grid-cols-12 gap-6 mt-4">
        
        {/* LEFT COLUMN: Player (NVIDIA) */}
        <div className="lg:col-span-3 space-y-4">
          <Card className="border-t-4 border-t-[#76B900]">
            <div className="flex justify-between items-start mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Server className="w-5 h-5 text-[#76B900]" /> 
                Production
              </h2>
              <Badge color={player.backlog > 0 ? "red" : "green"}>
                {player.backlog > 0 ? "BACKLOGGED" : "OPTIMAL"}
              </Badge>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">Market Demand</p>
                <div className="text-3xl font-bold text-white">{DEMAND_SCHEDULE[week-1]} <span className="text-sm text-gray-500 font-normal">GPUs</span></div>
              </div>

              <div className="p-3 bg-red-900/10 border border-red-900/30 rounded">
                <div className="flex justify-between">
                  <p className="text-xs text-red-400 uppercase font-bold mb-1">Unmet Backlog</p>
                  <p className="text-xs text-gray-500 font-mono">${player.backlog * BACKLOG_COST_PER_UNIT}</p>
                </div>
                <div className="text-2xl font-mono text-red-500">{player.backlog}</div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-neutral-950 p-2 rounded text-center">
                  <p className="text-xs text-gray-500">CoWoS Inv</p>
                  <p className="font-mono text-blue-400">{player.inventory.cowos}</p>
                </div>
                <div className="bg-neutral-950 p-2 rounded text-center">
                  <p className="text-xs text-gray-500">HBM Inv</p>
                  <p className="font-mono text-purple-400">{player.inventory.hbm}</p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-blue-400" />
              Place Orders
            </h2>
            
            {gameState === 'THINKING' ? (
              <div className="py-12 flex flex-col items-center justify-center space-y-4 text-center">
                <Loader2 className="w-8 h-8 text-[#76B900] animate-spin" />
                <div>
                  <p className="text-white font-medium">AI Agents Thinking...</p>
                  <p className="text-xs text-gray-500 mt-1">TSMC & SK Hynix are calculating inventory.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* CoWoS Input */}
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm font-medium text-gray-300">Order from TSMC</label>
                  </div>
                  <input 
                    type="number"
                    disabled={gameState !== 'PLAY'}
                    value={orders.cowos}
                    onChange={(e) => handleInputChange('cowos', e.target.value)}
                    className={`w-full bg-neutral-950 border ${errors.cowos ? 'border-red-500' : 'border-neutral-700'} rounded p-2 text-white focus:border-[#76B900] focus:outline-none transition-colors`}
                  />
                  {errors.cowos && <p className="text-xs text-red-500 mt-1">{errors.cowos}</p>}
                </div>

                {/* HBM Input */}
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-sm font-medium text-gray-300">Order from SK Hynix</label>
                  </div>
                  <input 
                    type="number"
                    disabled={gameState !== 'PLAY'}
                    value={orders.hbm}
                    onChange={(e) => handleInputChange('hbm', e.target.value)}
                    className={`w-full bg-neutral-950 border ${errors.hbm ? 'border-red-500' : 'border-neutral-700'} rounded p-2 text-white focus:border-[#76B900] focus:outline-none transition-colors`}
                  />
                  {errors.hbm && <p className="text-xs text-red-500 mt-1">{errors.hbm}</p>}
                </div>

                <button 
                  onClick={handlePlayerSubmit}
                  disabled={gameState !== 'PLAY' || errors.cowos || errors.hbm}
                  className="w-full bg-[#76B900] hover:bg-[#66a300] disabled:bg-neutral-800 disabled:text-gray-500 text-black font-bold py-3 rounded transition-all flex items-center justify-center gap-2"
                >
                  Submit Orders
                  <Bot size={16} />
                </button>
              </div>
            )}
          </Card>
        </div>

        {/* CENTER COLUMN: Analytics */}
        <div className="lg:col-span-6 space-y-4">
          <Card className="h-96">
            <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 tracking-wider">Your Performance</h3>
            <ResponsiveContainer width="100%" height="90%">
              <LineChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="week" stroke="#666" />
                <YAxis stroke="#666" />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: '#171717', borderColor: '#333' }}
                  itemStyle={{ color: '#ccc' }}
                />
                <Legend />
                <Line type="monotone" dataKey="demand" stroke="#fff" strokeWidth={2} dot={false} name="Market Demand" />
                <Line type="monotone" dataKey="fulfilled" stroke="#76B900" strokeWidth={2} name="Sales" />
                <Line type="monotone" dataKey="backlog" stroke="#ef4444" strokeDasharray="5 5" name="Backlog" />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="h-64">
             <h3 className="text-sm font-bold text-gray-500 uppercase mb-4 tracking-wider">Supplier Inventory (AI Managed)</h3>
             <ResponsiveContainer width="100%" height="85%">
              <AreaChart data={history}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis dataKey="week" stroke="#666" />
                <YAxis stroke="#666" />
                <RechartsTooltip contentStyle={{ backgroundColor: '#171717', borderColor: '#333' }} />
                <Legend />
                <Area type="monotone" dataKey="aiCowosInv" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="TSMC Inventory" />
                <Area type="monotone" dataKey="aiHbmInv" stackId="1" stroke="#a855f7" fill="#a855f7" fillOpacity={0.2} name="SK Hynix Inventory" />
              </AreaChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* RIGHT COLUMN: AI Agents */}
        <div className="lg:col-span-3 space-y-4">
          
          <Card>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Truck className="w-5 h-5 text-yellow-500" />
              Incoming to You
            </h2>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
              {player.pipeline.filter(p => p.arrivalWeek > week).length === 0 ? (
                <p className="text-sm text-gray-600 italic text-center py-4">No shipments en route</p>
              ) : (
                player.pipeline
                  .filter(p => p.arrivalWeek > week)
                  .sort((a, b) => a.arrivalWeek - b.arrivalWeek)
                  .map((shipment, idx) => (
                    <div key={idx} className="bg-neutral-950 p-2 rounded border border-neutral-800 flex justify-between items-center">
                      <div className="flex items-center gap-2">
                         <div className={`w-2 h-2 rounded-full ${shipment.type === 'cowos' ? 'bg-blue-500' : 'bg-purple-500'}`}></div>
                         <span className="text-sm text-gray-300 capitalize">{shipment.type === 'cowos' ? 'CoWoS' : 'HBM'}</span>
                      </div>
                      <div className="text-right">
                         <div className="text-sm font-bold text-white">{shipment.amount}</div>
                         <div className="text-[10px] text-gray-500 uppercase">Arrives Wk {shipment.arrivalWeek}</div>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </Card>

          {/* AI Supplier Status */}
          <Card className="relative overflow-hidden">
            {gameState === 'THINKING' && (
              <div className="absolute inset-0 bg-neutral-900/80 flex items-center justify-center z-10 backdrop-blur-[1px]">
                 <Loader2 className="text-[#76B900] animate-spin" size={32} />
              </div>
            )}
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Database className="w-5 h-5 text-gray-400" />
              AI Agent Status
            </h2>
            
            <div className="space-y-4">
              {/* CoWoS Agent */}
              <div className="p-3 rounded bg-neutral-950 border border-neutral-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-blue-400">TSMC Agent</span>
                  <Badge color={suppliers.cowos.backlog > 0 ? "red" : "blue"}>
                    {suppliers.cowos.backlog > 0 ? `BACKLOG: ${suppliers.cowos.backlog}` : "OK"}
                  </Badge>
                </div>
                <div className="text-xs text-gray-500 mb-1">Last Action: Ordered {suppliers.cowos.lastOrder} units</div>
                <div className="bg-neutral-900 p-2 rounded">
                  <p className="text-xs text-gray-300 italic">"{suppliers.cowos.reasoning}"</p>
                </div>
              </div>

              {/* HBM Agent */}
              <div className="p-3 rounded bg-neutral-950 border border-neutral-800">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-bold text-purple-400">SK Hynix Agent</span>
                   <Badge color={suppliers.hbm.backlog > 0 ? "red" : "purple"}>
                    {suppliers.hbm.backlog > 0 ? `BACKLOG: ${suppliers.hbm.backlog}` : "OK"}
                  </Badge>
                </div>
                <div className="text-xs text-gray-500 mb-1">Last Action: Ordered {suppliers.hbm.lastOrder} units</div>
                <div className="bg-neutral-900 p-2 rounded">
                  <p className="text-xs text-gray-300 italic">"{suppliers.hbm.reasoning}"</p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </main>

      {/* Game Over Modal */}
      {gameState === 'END' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-neutral-900 border border-neutral-700 p-8 rounded-xl max-w-lg w-full shadow-2xl">
            <h2 className="text-3xl font-bold text-white mb-2">Simulation Complete</h2>
            <div className="grid grid-cols-2 gap-4 mb-6 mt-6">
              <div className="bg-black/50 p-4 rounded border border-neutral-800">
                <span className="text-gray-500 text-xs uppercase">Your Cost</span>
                <div className="text-2xl font-bold text-red-400">${player.cash.toLocaleString()}</div>
              </div>
              <div className="bg-black/50 p-4 rounded border border-neutral-800">
                <span className="text-gray-500 text-xs uppercase">Avg Backlog</span>
                <div className="text-2xl font-bold text-yellow-400">
                  {Math.round(history.reduce((a, b) => a + b.backlog, 0) / MAX_WEEKS)}
                </div>
              </div>
            </div>

            <button 
              onClick={restartGame}
              className="w-full bg-[#76B900] hover:bg-[#66a300] text-black font-bold py-3 rounded transition-colors"
            >
              Start New Simulation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}