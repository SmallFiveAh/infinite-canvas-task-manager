import { useState } from 'react'
import InfiniteCanvas from './InfiniteCanvas'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <>
      <InfiniteCanvas />
    </>
  )
}

export default App
