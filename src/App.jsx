
import Chatbot from './pages/Chatbot'
import LandingPage from './pages/LandingPage';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginPage from './pages/LoginPage';


 const App = () => {
  return (
   <BrowserRouter>
    <Routes>
      <Route path='/chat' element={<Chatbot/>}/>
      <Route path='' element={<LandingPage/>}/>
      <Route path='/login' element={<LoginPage/>}/>
    </Routes>
   </BrowserRouter>
  )
}
export default App