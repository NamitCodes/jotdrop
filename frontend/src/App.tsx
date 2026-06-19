import { useState } from "react"
import { Button } from "./components/Button"
import { Card } from "./components/Card"
import { CreateContentModal } from "./components/CreateContentModal"
import { Sidebar } from "./components/Sidebar"
import { PlusIcon } from "./icons/PlusIcon"
import { ShareIcon } from "./icons/ShareIcon"


function App() {
    const [modalOpen, setModalOpen] = useState(false);

  return <div>

      <Sidebar />

    <div className="p-4 ml-72 min-h-screen bg-gray-100">
      <CreateContentModal open={modalOpen} onClose={() => {setModalOpen(false)}}/>

      <div className="flex justify-end gap-4">
        <Button onClick={() => {setModalOpen(true)}} variant="primary" text="Add content" startIcon={<PlusIcon />} ></Button>
        <Button variant="secondary" text="Share Brain" startIcon={< ShareIcon/>} ></Button>
      </div>

      <div className="flex gap-4">
        <Card title="First Tweet" link="https://x.com/whoisasx/status/2066868666281648321" type="twitter" ></Card>

        <Card title="First Video" link="https://www.youtube.com/watch?v=pfU88fEQZ1E" type="youtube" ></Card>
      </div>
    
    </div>
    

    
  </div>
}

export default App

// add some :hover and click animations on buttons
// modal should close when somewhere outside is clicked