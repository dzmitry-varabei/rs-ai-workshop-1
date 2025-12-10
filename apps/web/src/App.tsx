import { useState, useEffect } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>English Learning Quiz</h1>
      <p>Web app structure is ready!</p>
      <p>
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
      </p>
    </div>
  );
}

export default App;

