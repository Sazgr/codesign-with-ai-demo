import React, { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { Truck, Factory, Store, AlertCircle, ShoppingBag, DollarSign, TrendingUp, Package, Activity, Info, Bot, Cpu, BrainCircuit } from 'lucide-react';

// --- Constants & Config ---
const MAX_WEEKS = 20;
const HOLDING_COST = 0.50;
const BACKLOG_COST = 2.00; // For DC
const SUPPLIER_BACKLOG_COST = 5.00; // Higher penalty for manufacturers to encourage stock
const LEAD_TIME = 2; // Weeks for delivery to DC
const PRODUCTION_DELAY = 2; // Weeks for Manufacturer production
const API_KEY = ""; // User to provide

const THEME = {
  red: '#DA291C',
  yellow: '#FFC72C',
  darkRed: '#B01B12',
  bg: '#f8f9fa',
  text: '#292929'
};

// --- Initial State Generators ---
const generateInitialInventory = () => ({ buns: 1500, beef: 1000, fish: 500 });
const generateEmptyOrder = () => ({ buns: 0, beef: 0, fish: 0 });

// Internal state for an AI Supplier
const generateSupplierState = (role, initialInv) => ({
  role,
  inventory: initialInv,
  backlog: 0,
  productionQueue: [], // { weekArrives, amount }
  lastOrderReceived: 0,
  history: [], // For AI context
  lastReasoning: "Simulation started. Ready for orders.",
  lastProductionOrder: 0
});

const App = () => {
  // --- Game State ---
  const [week, setWeek] = useState(1);
  const [gameOver, setGameOver] = useState(false);
  const [turnPhase, setTurnPhase] = useState('PLAYER'); // PLAYER, AI_ARYZTA, AI_TYSON, PROCESSING
  const [apiKey, setApiKey] = useState(API_KEY);
  
  // Resources (Player / DC)
  const [inventory, setInventory] = useState(generateInitialInventory());
  const [backlog, setBacklog] = useState({ buns: 0, beef: 0, fish: 0 });
  const [totalCost, setTotalCost] = useState(0);

  // AI Opponents (Upstream)
  // Aryzta supplies Buns. Tyson supplies Beef & Fish (simplified: Tyson manages Beef mainly for logic, Fish auto-scaled or treated as Beef equivalent for simplicity in AI prompt, or we ask for both. Let's ask for distinct orders if possible, but to save API calls, maybe 1 call per supplier).
  // *Correction*: To keep it manageable, Tyson will reason about "Patties" generally or we make 2 calls. Let's do 2 sequential phases for AI to be clear.
  const [aryztaState, setAryztaState] = useState(generateSupplierState("Aryzta (Buns)", 3000));
  const [tysonState, setTysonState] = useState(generateSupplierState("Tyson (Protein)", 3000)); // Managing Beef/Fish aggregate for simplicity in this demo or distinct? Let's do distinct internal logic but 1 AI "brain" for Tyson.
  
  // Simulation Data
  const [history, setHistory] = useState([{ week: 0, inventory: 3000, backlog: 0, demand: 0 }]);
  const [messages, setMessages] = useState([{ type: 'info', text: 'Welcome, Martin Bower. Week 1 has started.' }]);
  
  // Demand (Restaurants)
  const [storeOrders, setStoreOrders] = useState({
    storeA: { bigMacs: 100, filets: 20 },
    storeB: { bigMacs: 90, filets: 30 },
    storeC: { bigMacs: 110, filets: 10 }
  });
  
  const [currentDemand, setCurrentDemand] = useState({ buns: 0, beef: 0, fish: 0 });

  // Supply Chain (Shipments in transit from Supplier to DC)
  const [shipments, setShipments] = useState([]);

  // User Input
  const [playerOrder, setPlayerOrder] = useState({ buns: 0, beef: 0, fish: 0 });

  // --- Helpers ---

  const addMessage = (type, text) => {
    setMessages(prev => [{ type, text }, ...prev].slice(0, 10)); 
  };

  const calculateIngredientDemand = (orders) => {
    let bunsNeeded = 0;
    let beefNeeded = 0;
    let fishNeeded = 0;

    Object.values(orders).forEach(order => {
      bunsNeeded += (order.bigMacs * 3) + (order.filets * 2);
      beefNeeded += (order.bigMacs * 2);
      fishNeeded += (order.filets * 1);
    });

    return { buns: bunsNeeded, beef: beefNeeded, fish: fishNeeded };
  };

  // --- Gemini AI Integration ---

  const getAITurn = async (agentName, agentState, currentDemandFromPlayer) => {
    if (!apiKey) {
      console.warn("No API Key provided, using fallback logic.");
      // Fallback: Simple Order-Up-To Policy
      const target = agentState.lastOrderReceived * 1.5 || 200;
      const order = Math.max(0, target - agentState.inventory + agentState.backlog);
      return { 
        order: Math.round(order), 
        reasoning: "API Key missing. Fallback strategy: Target inventory maintenance." 
      };
    }

    const prompt = `
      You are playing a Supply Chain Simulation Game.
      Role: Factory Manager for ${agentName}.
      Goal: Minimize costs. Holding Cost: $0.50/unit. Backlog Penalty: $2.00/unit.
      
      Current State:
      - Week: ${week}
      - Your Inventory: ${agentState.inventory}
      - Your Backlog (Owed to Distributor): ${agentState.backlog}
      - Incoming Order from Distributor (Player): ${currentDemandFromPlayer} units
      - History (Last 3 Weeks): ${JSON.stringify(agentState.history.slice(-3))}
      
      Constraint:
      - Production Delay: ${PRODUCTION_DELAY} weeks. (Order placed now arrives in Week ${week + PRODUCTION_DELAY}).
      - Avoid the Bullwhip Effect (do not over-react to spikes, but do not stockout).
      
      Task: Decide your PRODUCTION ORDER quantity for this week.
      
      Response Format (JSON ONLY):
      {
        "order": <integer>,
        "reasoning": "<short string explaining why>"
      }
    `;

    try {
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: "application/json" }
        })
      });

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
      const result = JSON.parse(text);
      return result;
    } catch (error) {
      console.error("Gemini API Error:", error);
      return { order: currentDemandFromPlayer, reasoning: "AI Brain Freeze (Error). Matching demand." };
    }
  };

  // --- Game Loop Logic ---

  useEffect(() => {
    const demand = calculateIngredientDemand(storeOrders);
    setCurrentDemand(demand);
  }, []);

  // Triggered when Player clicks "Start AI Turn"
  const startTurnSequence = async () => {
    if (week >= MAX_WEEKS) return;
    
    // 1. Player Turn Done -> Switch to Aryzta
    setTurnPhase('AI_ARYZTA');
    
    // Execute Aryzta Logic
    // Aryzta manages Buns
    const bunsOrderFromPlayer = playerOrder.buns;
    
    // Artificial delay for UI "Thinking"
    await new Promise(r => setTimeout(r, 1000));
    
    const aryztaDecision = await getAITurn("Aryzta (Buns)", aryztaState, bunsOrderFromPlayer);
    
    // Update Aryzta Internal State
    setAryztaState(prev => ({
      ...prev,
      lastReasoning: aryztaDecision.reasoning,
      lastProductionOrder: aryztaDecision.order,
      history: [...prev.history, { week, orderReceived: bunsOrderFromPlayer, inventory: prev.inventory, production: aryztaDecision.order }]
    }));

    // 2. Switch to Tyson
    setTurnPhase('AI_TYSON');
    
    // Execute Tyson Logic (Combined Beef+Fish for simplicity of API call, usually we'd split)
    // Let's sum them for the "AI Brain" but split proportionally for the logic
    const totalMeatOrder = playerOrder.beef + playerOrder.fish;
    
    await new Promise(r => setTimeout(r, 1000));
    const tysonDecision = await getAITurn("Tyson (Meat)", tysonState, totalMeatOrder);
    
    setTysonState(prev => ({
      ...prev,
      lastReasoning: tysonDecision.reasoning,
      lastProductionOrder: tysonDecision.order,
       history: [...prev.history, { week, orderReceived: totalMeatOrder, inventory: prev.inventory, production: tysonDecision.order }]
    }));

    // 3. Resolve Week
    setTurnPhase('PROCESSING');
    await new Promise(r => setTimeout(r, 500));
    resolveWeek(aryztaDecision.order, tysonDecision.order);
  };

  const resolveWeek = (aryztaProduction, tysonProduction) => {
    // --- Step 1: Upstream (Supplier) Logic ---
    
    // Function to handle a single supplier's logic
    const processSupplier = (state, productionAmount, playerOrderAmount) => {
      let newState = { ...state };
      
      // 1. Receive Production (placed 2 weeks ago)
      const arrivingProduction = newState.productionQueue.find(p => p.weekArrives === week + 1);
      if (arrivingProduction) {
        newState.inventory += arrivingProduction.amount;
      }
      
      // 2. Queue New Production (from AI decision)
      newState.productionQueue.push({ weekArrives: week + 1 + PRODUCTION_DELAY, amount: productionAmount });
      
      // 3. Ship to Player
      const totalOwed = playerOrderAmount + newState.backlog;
      let shippedAmount = 0;
      
      if (newState.inventory >= totalOwed) {
        shippedAmount = totalOwed;
        newState.inventory -= totalOwed;
        newState.backlog = 0;
      } else {
        shippedAmount = newState.inventory;
        newState.backlog = totalOwed - newState.inventory;
        newState.inventory = 0;
      }
      
      newState.lastOrderReceived = playerOrderAmount;
      return { newState, shippedAmount };
    };

    // Process Aryzta (Buns)
    const aryztaResult = processSupplier(aryztaState, aryztaProduction, playerOrder.buns);
    setAryztaState(aryztaResult.newState);

    // Process Tyson (Beef & Fish) - Simplified: Tyson AI decides total meat. We split proportionally if shortage?
    // For simplicity, we'll assume Tyson's production covers both pools equally, or we treat Tyson as having one "Meat" inventory that converts to specific items.
    // Let's keep it simple: Tyson has one inventory for "Units of Meat". 
    const tysonResult = processSupplier(tysonState, tysonProduction, playerOrder.beef + playerOrder.fish);
    setTysonState(tysonResult.newState);
    
    // BUT we need to know specifically how many Beef vs Fish were shipped.
    // If Tyson has shortage, we ratio it.
    let shippedBeef = playerOrder.beef;
    let shippedFish = playerOrder.fish;
    const tysonDemandTotal = playerOrder.beef + playerOrder.fish + tysonState.backlog; // Approx
    
    // Service Level Ratio
    const serviceLevel = tysonDemandTotal > 0 ? tysonResult.shippedAmount / tysonDemandTotal : 1;
    // This is an approximation since backlog tracking per item type in a combined supplier is complex. 
    // We will apply the ratio to the *current* order.
    shippedBeef = Math.floor(playerOrder.beef * serviceLevel);
    shippedFish = Math.floor(playerOrder.fish * serviceLevel);
    
    // Note: This logic simplifies Tyson's backlog handling. In a full sim, we'd track backlog per SKU.

    // --- Step 2: Midstream (Player) Logic ---

    // Create Shipment Object for Player (Arrives in 2 weeks)
    const newShipment = {
      arrivalWeek: week + 1 + LEAD_TIME, 
      quantities: {
        buns: aryztaResult.shippedAmount,
        beef: shippedBeef,
        fish: shippedFish
      }
    };
    
    const updatedShipments = [...shipments, newShipment];
    setShipments(updatedShipments);
    
    // Log if Suppliers shorted the player
    if (aryztaResult.shippedAmount < playerOrder.buns) {
      addMessage('warning', `Aryzta Stockout! Only shipped ${aryztaResult.shippedAmount} / ${playerOrder.buns} Buns.`);
    }
    if (shippedBeef < playerOrder.beef || shippedFish < playerOrder.fish) {
      addMessage('warning', `Tyson Stockout! Shorted Beef/Fish shipments.`);
    }

    // --- Step 3: Player Receive & Consume (Standard Logic) ---
    
    // Receive Old Shipments
    const arrivingShipment = updatedShipments.find(s => s.arrivalWeek === week + 1);
    let newInventory = { ...inventory };
    
    if (arrivingShipment) {
      newInventory.buns += arrivingShipment.quantities.buns;
      newInventory.beef += arrivingShipment.quantities.beef;
      newInventory.fish += arrivingShipment.quantities.fish;
      addMessage('success', `Shipment arrived! +${arrivingShipment.quantities.buns} Buns, +${arrivingShipment.quantities.beef} Beef...`);
    }

    // Determine Total Demand (Current Week + Backlog)
    const totalNeeds = {
      buns: currentDemand.buns + backlog.buns,
      beef: currentDemand.beef + backlog.beef,
      fish: currentDemand.fish + backlog.fish
    };

    // Fulfill
    let newBacklog = { buns: 0, beef: 0, fish: 0 };
    ['buns', 'beef', 'fish'].forEach(item => {
      if (newInventory[item] >= totalNeeds[item]) {
        newInventory[item] -= totalNeeds[item];
        newBacklog[item] = 0;
      } else {
        newBacklog[item] = totalNeeds[item] - newInventory[item];
        newInventory[item] = 0;
      }
    });

    // Costs
    const totalItemsHeld = newInventory.buns + newInventory.beef + newInventory.fish;
    const totalItemsBacklog = newBacklog.buns + newBacklog.beef + newBacklog.fish;
    const weeklyCost = (totalItemsHeld * HOLDING_COST) + (totalItemsBacklog * BACKLOG_COST);
    const newTotalCost = totalCost + weeklyCost;

    if (totalItemsBacklog > 0) {
      addMessage('error', `Stockout! Backlog of ${totalItemsBacklog} units incurred penalty.`);
    }

    // --- Step 4: Generate Next Week Demand ---
    const nextWeek = week + 1;
    let multiplier = 1.0;
    
    // Bullwhip Trigger
    if (nextWeek === 5) {
      multiplier = 2.5;
      addMessage('warning', "HEADQUARTERS ALERT: 'Mac for All' campaign starts now! Massive demand spike.");
    } else if (nextWeek === 6) multiplier = 1.8;
    else multiplier = 0.8 + (Math.random() * 0.4);

    const generateStoreDemand = (baseBM, baseF) => ({
      bigMacs: Math.floor(baseBM * multiplier),
      filets: Math.floor(baseF * multiplier)
    });

    const nextStoreOrders = {
      storeA: generateStoreDemand(100, 20),
      storeB: generateStoreDemand(90, 30),
      storeC: generateStoreDemand(110, 10)
    };
    
    const nextIngredientDemand = calculateIngredientDemand(nextStoreOrders);

    // Update All State
    setInventory(newInventory);
    setBacklog(newBacklog);
    setTotalCost(newTotalCost);
    setStoreOrders(nextStoreOrders);
    setCurrentDemand(nextIngredientDemand);
    setWeek(nextWeek);
    setPlayerOrder(generateEmptyOrder());
    
    setHistory(prev => [...prev, {
      week: nextWeek,
      inventory: totalItemsHeld,
      backlog: totalItemsBacklog,
      cost: newTotalCost
    }]);

    if (nextWeek === MAX_WEEKS) setGameOver(true);
    setTurnPhase('PLAYER');
  };

  // --- UI Components ---

  const OrderInput = ({ label, type, value, onChange, icon: Icon, color }) => (
    <div className="flex flex-col space-y-1">
      <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
        <Icon size={14} className={color} /> {label}
      </label>
      <input
        type="number"
        min="0"
        value={value === 0 ? '' : value}
        onChange={(e) => onChange(type, parseInt(e.target.value) || 0)}
        className="w-full border-2 border-gray-200 rounded-lg p-2 text-lg font-bold focus:border-[#DA291C] focus:ring-[#DA291C] focus:outline-none transition-all disabled:bg-gray-100 disabled:text-gray-400"
        placeholder="0"
        disabled={gameOver || turnPhase !== 'PLAYER'}
      />
    </div>
  );

  const StatCard = ({ title, value, subValue, icon: Icon, alert }) => (
    <div className={`bg-white p-4 rounded-xl shadow-sm border-l-4 ${alert ? 'border-red-500 bg-red-50' : 'border-[#FFC72C]'} relative overflow-hidden`}>
      <div className="flex justify-between items-start z-10 relative">
        <div>
          <h3 className="text-gray-500 text-xs font-bold uppercase tracking-wider">{title}</h3>
          <div className="text-2xl font-black text-gray-800 mt-1">{value.toLocaleString()}</div>
          {subValue && <div className="text-xs text-red-600 font-bold mt-1">{subValue}</div>}
        </div>
        <div className={`p-2 rounded-full ${alert ? 'bg-red-100 text-red-600' : 'bg-yellow-50 text-yellow-600'}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen font-sans text-gray-800 bg-gray-50 flex flex-col relative">
      
      {/* API Key Modal if missing */}
      {!apiKey && (
        <div className="bg-[#DA291C] text-white p-2 text-center text-xs font-bold">
           Demo Mode: AI will use fallback logic. To enable Gemini, set API_KEY in code.
        </div>
      )}

      {/* Header */}
      <header className="bg-[#DA291C] text-white p-4 shadow-lg z-20 sticky top-0">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="bg-[#FFC72C] p-2 rounded-lg text-[#DA291C] font-black text-xl leading-none">M</div>
            <div>
              <h1 className="font-bold text-lg leading-tight">Supply Chain AI Sim</h1>
              <p className="text-xs text-red-100 opacity-90">Regional DC Manager: Martin Bower</p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
             <div className="text-right">
              <div className="text-xs text-red-200 uppercase font-bold">Total Cost</div>
              <div className="text-2xl font-black text-[#FFC72C]">${totalCost.toLocaleString(undefined, {minimumFractionDigits: 2})}</div>
            </div>
            <div className="flex flex-col items-end">
              <span className="text-xs font-bold uppercase bg-red-800 px-2 py-1 rounded text-white">Week {week} / {MAX_WEEKS}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-grow p-4 md:p-6 max-w-7xl mx-auto w-full grid grid-cols-1 md:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: DOWNSTREAM DEMAND */}
        <div className="md:col-span-3 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-800 text-white p-3 flex items-center justify-between">
              <h2 className="font-bold flex items-center gap-2"><Store size={18} /> Downstream</h2>
              <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">Restaurants</span>
            </div>
            <div className="bg-gray-50 p-4 border-b border-gray-100">
              <h3 className="text-xs font-bold text-gray-500 uppercase mb-2">Incoming Demand</h3>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white p-2 rounded shadow-sm">
                  <div className="text-xs text-gray-400">Buns</div>
                  <div className="font-bold text-[#DA291C]">{currentDemand.buns}</div>
                </div>
                <div className="bg-white p-2 rounded shadow-sm">
                  <div className="text-xs text-gray-400">Beef</div>
                  <div className="font-bold text-[#DA291C]">{currentDemand.beef}</div>
                </div>
                <div className="bg-white p-2 rounded shadow-sm">
                  <div className="text-xs text-gray-400">Fish</div>
                  <div className="font-bold text-[#DA291C]">{currentDemand.fish}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Activity Log */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-96 flex flex-col">
            <div className="bg-gray-100 p-3 border-b border-gray-200">
              <h2 className="font-bold text-sm text-gray-700 flex items-center gap-2"><Activity size={16} /> Activity Log</h2>
            </div>
            <div className="p-4 overflow-y-auto space-y-3 flex-grow bg-gray-50">
              {messages.map((msg, idx) => (
                <div key={idx} className={`text-xs p-2 rounded border-l-2 ${
                  msg.type === 'error' ? 'bg-red-50 border-red-500 text-red-800' :
                  msg.type === 'warning' ? 'bg-yellow-50 border-yellow-500 text-yellow-800' :
                  msg.type === 'success' ? 'bg-green-50 border-green-500 text-green-800' :
                  'bg-white border-gray-300 text-gray-600'
                }`}>
                  {msg.text}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* CENTER COLUMN: PLAYER / DC */}
        <div className="md:col-span-6 space-y-6">
          
          {/* Inventory Dashboard */}
          <div className="grid grid-cols-3 gap-4">
            <StatCard 
              title="Buns" 
              value={inventory.buns} 
              subValue={backlog.buns > 0 ? `Backlog: ${backlog.buns}` : null}
              icon={Package} 
              alert={backlog.buns > 0}
            />
            <StatCard 
              title="Beef Patties" 
              value={inventory.beef}
              subValue={backlog.beef > 0 ? `Backlog: ${backlog.beef}` : null}
              icon={Package} 
              alert={backlog.beef > 0}
            />
            <StatCard 
              title="Fish Patties" 
              value={inventory.fish}
              subValue={backlog.fish > 0 ? `Backlog: ${backlog.fish}` : null}
              icon={Package} 
              alert={backlog.fish > 0}
            />
          </div>

          {/* Order Console */}
          <div className="bg-white rounded-xl shadow-lg border-t-4 border-[#DA291C] overflow-hidden relative">
             {/* AI Turn Overlay */}
             {turnPhase !== 'PLAYER' && !gameOver && (
               <div className="absolute inset-0 bg-white/90 z-20 flex flex-col items-center justify-center text-center p-6 backdrop-blur-sm">
                  <div className="bg-blue-50 p-4 rounded-full mb-4 animate-pulse">
                     <BrainCircuit size={48} className="text-blue-600" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-800 mb-1">
                    {turnPhase === 'AI_ARYZTA' ? 'Aryzta (AI) is Thinking...' : 
                     turnPhase === 'AI_TYSON' ? 'Tyson (AI) is Thinking...' : 
                     'Processing Week...'}
                  </h3>
                  <p className="text-sm text-gray-500 max-w-md">
                     The AI is analyzing your order and deciding its own production strategy to minimize costs.
                  </p>
               </div>
             )}

             <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">Replenishment Console</h2>
                    <p className="text-sm text-gray-500 flex items-center gap-1"><Info size={14}/> Lead Time: {LEAD_TIME} Weeks</p>
                  </div>
                  <button 
                    onClick={startTurnSequence}
                    disabled={gameOver || turnPhase !== 'PLAYER'}
                    className={`px-6 py-3 rounded-lg font-bold shadow-md transition-transform active:scale-95 flex items-center gap-2 ${
                      gameOver ? 'bg-gray-400 cursor-not-allowed' : 
                      turnPhase !== 'PLAYER' ? 'bg-gray-200 text-gray-400' :
                      'bg-[#FFC72C] hover:bg-[#ffcf4d] text-[#DA291C]'
                    }`}
                  >
                    {gameOver ? 'Simulation Ended' : 
                     turnPhase === 'PLAYER' ? 'Place Orders & Start AI Turn' : 'AI Playing...'} 
                     <Bot size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-6">
                   <OrderInput 
                      label="Order Buns (Aryzta)" 
                      type="buns" 
                      value={playerOrder.buns} 
                      onChange={(k, v) => setPlayerOrder({...playerOrder, [k]: v})}
                      icon={Factory}
                      color="text-yellow-600"
                   />
                   <OrderInput 
                      label="Order Beef (Tyson)" 
                      type="beef" 
                      value={playerOrder.beef} 
                      onChange={(k, v) => setPlayerOrder({...playerOrder, [k]: v})}
                      icon={Factory}
                      color="text-red-600"
                   />
                   <OrderInput 
                      label="Order Fish (Tyson)" 
                      type="fish" 
                      value={playerOrder.fish} 
                      onChange={(k, v) => setPlayerOrder({...playerOrder, [k]: v})}
                      icon={Factory}
                      color="text-blue-600"
                   />
                </div>
             </div>
          </div>

          {/* Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-72">
            <h3 className="text-sm font-bold text-gray-600 mb-2">Inventory Levels vs. Backlog Trend</h3>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={history}>
                <defs>
                  <linearGradient id="colorInv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FFC72C" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#FFC72C" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorBack" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#DA291C" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#DA291C" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eee"/>
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip 
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'}}
                />
                <Legend />
                <Area type="monotone" dataKey="inventory" stroke="#FFC72C" fillOpacity={1} fill="url(#colorInv)" name="Total Inventory" />
                <Area type="monotone" dataKey="backlog" stroke="#DA291C" fillOpacity={1} fill="url(#colorBack)" name="Total Backlog" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* RIGHT COLUMN: UPSTREAM SUPPLY */}
        <div className="md:col-span-3 space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="bg-gray-800 text-white p-3 flex items-center justify-between">
              <h2 className="font-bold flex items-center gap-2"><Factory size={18} /> Upstream (AI)</h2>
              <span className="text-xs bg-gray-700 px-2 py-1 rounded text-gray-300">Manufacturers</span>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Aryzta Status */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                   <div className="font-bold text-sm text-gray-700">Aryzta (Buns)</div>
                   {aryztaState.backlog > 0 && <span className="text-xs bg-red-100 text-red-600 px-2 rounded-full font-bold">Backlog: {aryztaState.backlog}</span>}
                </div>
                <div className="text-xs text-gray-500 italic border-l-2 border-yellow-400 pl-2 mb-2">
                  "{aryztaState.lastReasoning}"
                </div>
                <div className="flex justify-between text-xs font-bold text-gray-400">
                   <span>Last Production: {aryztaState.lastProductionOrder}</span>
                   <span>Inv: {aryztaState.inventory}</span>
                </div>
              </div>

               {/* Tyson Status */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                   <div className="font-bold text-sm text-gray-700">Tyson (Meat)</div>
                   {tysonState.backlog > 0 && <span className="text-xs bg-red-100 text-red-600 px-2 rounded-full font-bold">Backlog: {tysonState.backlog}</span>}
                </div>
                <div className="text-xs text-gray-500 italic border-l-2 border-red-400 pl-2 mb-2">
                  "{tysonState.lastReasoning}"
                </div>
                 <div className="flex justify-between text-xs font-bold text-gray-400">
                   <span>Last Production: {tysonState.lastProductionOrder}</span>
                   <span>Inv: {tysonState.inventory}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex-grow">
            <div className="bg-gray-100 p-3 border-b border-gray-200">
              <h2 className="font-bold text-sm text-gray-700 flex items-center gap-2"><Truck size={16} /> Incoming Shipments</h2>
            </div>
            <div className="p-4 space-y-3">
              {shipments.filter(s => s.arrivalWeek > week).length === 0 ? (
                <div className="text-center text-gray-400 text-sm py-4 italic">No shipments in transit.</div>
              ) : (
                shipments
                  .filter(s => s.arrivalWeek > week)
                  .sort((a, b) => a.arrivalWeek - b.arrivalWeek)
                  .map((ship, idx) => (
                    <div key={idx} className="bg-white border border-gray-200 rounded-lg p-3 shadow-sm relative">
                       <div className="absolute -top-2 -right-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full shadow">
                         W{ship.arrivalWeek}
                       </div>
                       <div className="text-xs font-bold text-gray-500 uppercase mb-1">In Transit</div>
                       <div className="grid grid-cols-3 gap-1 text-xs">
                          {ship.quantities.buns > 0 && <span className="bg-yellow-50 text-yellow-800 px-1 rounded">Buns: {ship.quantities.buns}</span>}
                          {ship.quantities.beef > 0 && <span className="bg-red-50 text-red-800 px-1 rounded">Beef: {ship.quantities.beef}</span>}
                          {ship.quantities.fish > 0 && <span className="bg-blue-50 text-blue-800 px-1 rounded">Fish: {ship.quantities.fish}</span>}
                       </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </main>

      {/* Game Over Modal */}
      {gameOver && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-8 text-center border-t-8 border-[#DA291C]">
            <h2 className="text-3xl font-black text-gray-800 mb-2">Simulation Complete</h2>
            <p className="text-gray-500 mb-6">Regional Distribution Center Performance Report</p>
            
            <div className="bg-gray-50 rounded-xl p-6 mb-6 grid grid-cols-2 gap-4">
              <div className="text-left">
                <div className="text-xs uppercase text-gray-400 font-bold">Total Cost</div>
                <div className="text-2xl font-black text-[#DA291C]">${totalCost.toLocaleString()}</div>
              </div>
              <div className="text-left">
                <div className="text-xs uppercase text-gray-400 font-bold">Avg Backlog</div>
                <div className="text-2xl font-black text-gray-800">
                  {Math.round(history.reduce((acc, curr) => acc + curr.backlog, 0) / history.length)} units
                </div>
              </div>
            </div>

            <p className="text-sm text-gray-600 mb-6">
              {totalCost < 50000 ? "Excellent work! Costs were kept minimal." : 
               totalCost < 100000 ? "Good effort. Supply chain was stable but costly." : 
               "High costs detected. The Bullwhip Effect likely caused significant overstocking or backlogs."}
            </p>

            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-[#FFC72C] hover:bg-[#ffcf4d] text-gray-900 font-bold py-3 rounded-lg transition-colors"
            >
              Restart Simulation
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;