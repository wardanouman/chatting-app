import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const socket = io("https://chatting-app-production-c1fa.up.railway.app");

const CHAT_ROOMS = [
  { id: 'general', name: 'General Chat Room', description: 'Real-time room messaging' },
  { id: 'tech', name: 'Tech & Code', description: 'Discuss web dev & projects' },
  { id: 'random', name: 'Random Lounge', description: 'Casual chats & banter' },
];

export default function App() {
  const [username, setUsername] = useState(() => sessionStorage.getItem('chat_username') || '');
  const [password, setPassword] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(() => sessionStorage.getItem('chat_isLoggedIn') === 'true');
  
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [activeRoom, setActiveRoom] = useState(CHAT_ROOMS[0]);
  const [typingUser, setTypingUser] = useState('');

  const [activeMenuId, setActiveMenuId] = useState(null);
  const [editingId, setEditingId] = useState(null);

  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, typingUser]);

  useEffect(() => {
    if (!isLoggedIn || !username) return;

    const joinCurrentRoom = () => {
      socket.emit("join", { roomId: activeRoom.id, username });
    };

    if (socket.connected) {
      joinCurrentRoom();
    }

    socket.on("connect", joinCurrentRoom);

    socket.on("load_history", (history) => {
      setMessages(history || []);
    });

    socket.on("message", (data) => {
      setMessages((prev) => [...prev, data]);
    });

    socket.on("user_typing", (data) => {
      if (data.room === activeRoom.id && data.user !== username) {
        setTypingUser(data.user);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => setTypingUser(''), 2500);
      }
    });

    return () => {
      socket.off("connect", joinCurrentRoom);
      socket.off("load_history");
      socket.off("message");
      socket.off("user_typing");
    };
  }, [isLoggedIn, activeRoom.id, username]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) return;

    sessionStorage.setItem('chat_username', username.trim());
    sessionStorage.setItem('chat_isLoggedIn', 'true');

    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    sessionStorage.removeItem('chat_username');
    sessionStorage.removeItem('chat_isLoggedIn');

    socket.emit("leave", activeRoom.id);
    setIsLoggedIn(false);
    setUsername('');
    setPassword('');
    setMessages([]);
  };

  const handleRoomSwitch = (room) => {
    if (room.id === activeRoom.id) return;
    setActiveRoom(room);
    setMessages([]);
    setTypingUser('');
    setActiveMenuId(null);
    setEditingId(null);
    socket.emit("join", { roomId: room.id, username });
  };

  const handleInputChange = (e) => {
    setMessage(e.target.value);
    if (!editingId) {
      socket.emit("typing", { room: activeRoom.id, user: username });
    }
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!message.trim()) return;

    if (editingId) {
      // Edit Existing Message
      socket.emit("edit_message", {
        room: activeRoom.id,
        id: editingId,
        newText: message.trim()
      });
      setEditingId(null);
      setMessage('');
    } else {
      // Send New Message
      const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      socket.emit("send", { room: activeRoom.id, message: message.trim(), sender: username, time });
      setMessage('');
    }
  };

  const handleStartEdit = (e, msg) => {
    e.stopPropagation();
    setEditingId(msg.id);
    setMessage(msg.message);
    setActiveMenuId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setMessage('');
  };

  const handleDeleteMessage = (e, msgId) => {
    e.stopPropagation();
    if (!msgId) return;
    socket.emit("delete_message", { room: activeRoom.id, id: msgId });
    setActiveMenuId(null);
  };

  if (!isLoggedIn) {
    return (
      <div className="bg-whatsapp-dark h-screen flex items-center justify-center font-sans text-gray-200 select-none">
        <form onSubmit={handleLogin} className="w-full max-w-md p-8 bg-whatsapp-panel rounded-2xl shadow-2xl border border-gray-700/50">
          <div className="flex flex-col items-center mb-6">
            <div className="w-16 h-16 bg-whatsapp-green rounded-full flex items-center justify-center mb-3 shadow-lg">
              <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12.031 2c-5.517 0-9.997 4.48-9.997 9.998 0 2.155.684 4.153 1.848 5.792L2 22l4.331-1.385c1.583.914 3.414 1.414 5.7 1.414 5.518 0 10-4.481 10-10S17.549 2 12.031 2zm0 18.286c-1.95 0-3.729-.533-5.263-1.462l-.377-.229-2.569.821.829-2.5-.251-.399c-1.018-1.616-1.554-3.484-1.554-5.519 0-4.412 3.588-8 8-8s8 3.588 8 8-3.588 8-8 8z"/>
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-100">Welcome to WhatsApp</h2>
            <p className="text-xs text-gray-400 mt-1">Enter your account credentials to log in</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Username</label>
              <input
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-whatsapp-input text-white border border-transparent focus:border-whatsapp-green focus:outline-none transition"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Password</label>
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg bg-whatsapp-input text-white border border-transparent focus:border-whatsapp-green focus:outline-none transition"
              />
            </div>
            <button
              type="submit"
              className="w-full py-3 mt-2 bg-whatsapp-green hover:opacity-90 text-white font-semibold rounded-lg shadow-md transition duration-200 active:scale-[0.98]"
            >
              Log In / Join Chat
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="bg-whatsapp-dark h-screen flex items-center justify-center font-sans text-gray-200 select-none">
      <div className="w-full max-w-5xl h-[90vh] bg-whatsapp-panel rounded-xl shadow-2xl overflow-hidden flex border border-gray-700/50">
        
        {/* Left Sidebar */}
        <div className="w-1/3 bg-whatsapp-dark border-r border-whatsapp-panel flex flex-col">
          <div className="h-16 bg-whatsapp-panel px-4 flex items-center justify-between border-b border-whatsapp-panel">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-[#6b7c85] text-white flex items-center justify-center font-bold text-lg">
                {username.charAt(0).toUpperCase()}
              </div>
              <span className="font-medium text-gray-200 text-sm truncate max-w-[100px]">{username}</span>
            </div>

            <button
              onClick={handleLogout}
              className="text-xs bg-red-600/80 hover:bg-red-600 text-white font-medium px-3 py-1.5 rounded-md transition duration-150 active:scale-95"
            >
              Log Out
            </button>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-800/40">
            {CHAT_ROOMS.map((room) => {
              const isActive = room.id === activeRoom.id;
              return (
                <div
                  key={room.id}
                  onClick={() => handleRoomSwitch(room)}
                  className={`p-3.5 flex items-center space-x-3 cursor-pointer transition ${
                    isActive ? 'bg-whatsapp-input' : 'hover:bg-whatsapp-panel/50'
                  }`}
                >
                  <div className="w-11 h-11 rounded-full bg-whatsapp-green flex items-center justify-center text-white font-bold text-lg">
                    #
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-gray-200 text-sm">{room.name}</h4>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{room.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Chat Window */}
        <div className="w-2/3 flex flex-col bg-whatsapp-bg relative" onClick={() => setActiveMenuId(null)}>
          <div className="h-16 bg-whatsapp-panel px-4 flex items-center space-x-3 border-b border-whatsapp-panel">
            <div className="w-10 h-10 rounded-full bg-whatsapp-green flex items-center justify-center text-white font-bold text-sm">
              #
            </div>
            <div>
              <h3 className="font-semibold text-gray-200 text-sm">{activeRoom.name}</h3>
              <span className="text-xs text-whatsapp-green">
                {typingUser ? (
                  <i className="animate-pulse">{typingUser} is typing...</i>
                ) : (
                  "online"
                )}
              </span>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-6 overflow-y-auto space-y-3 bg-[radial-gradient(#202c33_1px,transparent_1px)] [background-size:16px_16px]">
            {messages.map((msg, index) => {
              const isMine = msg.sender === username;
              const uniqueMsgId = msg.id || `legacy-${index}`;
              const isMenuOpen = activeMenuId === uniqueMsgId;

              return (
                <div key={uniqueMsgId} className={`flex ${isMine ? 'justify-end' : 'justify-start'} relative`}>
                  <div
                    onClick={(e) => {
                      if (!isMine) return;
                      e.stopPropagation();
                      setActiveMenuId((prev) => (prev === uniqueMsgId ? null : uniqueMsgId));
                    }}
                    className={`relative max-w-[70%] px-3 py-1.5 rounded-lg text-sm shadow-sm transition-all ${
                      isMine ? 'bg-whatsapp-bubble text-gray-100 cursor-pointer' : 'bg-whatsapp-panel text-gray-100'
                    }`}
                  >
                    {!isMine && (
                      <span className="block text-[11px] font-bold text-whatsapp-green mb-0.5">{msg.sender}</span>
                    )}
                    
                    <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                      <span className="text-sm leading-relaxed break-words flex-1 min-w-[30px]">
                        {msg.message}
                      </span>
                      
                      <div className="flex items-center space-x-1 text-[10px] text-gray-400 self-end ml-auto pt-1">
                        {msg.isEdited && <span className="italic text-gray-400 mr-1">edited</span>}
                        <span>{msg.time}</span>
                        {isMine && <span className="text-whatsapp-green font-bold text-[11px]">✓✓</span>}
                      </div>
                    </div>

                    {/* Popup Action Menu */}
                    {isMenuOpen && isMine && (
                      <div className="absolute right-0 top-full mt-1 w-28 bg-whatsapp-panel border border-gray-700 rounded-md shadow-xl z-20 overflow-hidden text-xs">
                        <button
                          onClick={(e) => handleStartEdit(e, { ...msg, id: uniqueMsgId })}
                          className="w-full text-left px-3 py-2 text-gray-200 hover:bg-whatsapp-input transition flex items-center space-x-2"
                        >
                          ✏️ <span>Edit</span>
                        </button>
                        <button
                          onClick={(e) => handleDeleteMessage(e, uniqueMsgId)}
                          className="w-full text-left px-3 py-2 text-red-400 hover:bg-whatsapp-input transition flex items-center space-x-2"
                        >
                          🗑️ <span>Delete</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Editing Mode Banner */}
          {editingId && (
            <div className="bg-whatsapp-input px-4 py-1.5 flex items-center justify-between border-t border-gray-700/50 text-xs text-whatsapp-green">
              <span>Editing message... Press Enter/Save to apply changes.</span>
              <button onClick={handleCancelEdit} className="text-gray-400 hover:text-white font-bold">✕ Cancel</button>
            </div>
          )}

          {/* Input Bar */}
          <form onSubmit={handleSendMessage} className="h-16 bg-whatsapp-panel px-4 flex items-center space-x-3 border-t border-whatsapp-panel">
            <input
              type="text"
              placeholder={editingId ? "Edit your message..." : "Type a message"}
              value={message}
              onChange={handleInputChange}
              className="flex-1 bg-whatsapp-input text-gray-200 text-sm px-4 py-2.5 rounded-lg focus:outline-none border border-transparent focus:border-whatsapp-green transition"
            />
            <button type="submit" className="p-2.5 bg-whatsapp-green hover:opacity-90 text-white rounded-lg transition active:scale-95">
              {editingId ? (
                <span className="font-bold text-xs px-1">Save</span>
              ) : (
                <svg className="w-5 h-5 rotate-90" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                </svg>
              )}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}