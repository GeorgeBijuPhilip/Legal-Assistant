import { useState, useCallback, useMemo } from 'react';
import Groq from 'groq-sdk';
import ReactMarkdown from 'react-markdown';
import { createWorker } from 'tesseract.js';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min?url'; // Use the worker URL
import './Chatbotstyles.css';

// Configure PDF.js to use the worker
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const Chatbot = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [error, setError] = useState(null);
  const apiKey = import.meta.env.VITE_GROQ_API_KEY;

  const groq = useMemo(() => new Groq({ apiKey, dangerouslyAllowBrowser: true }), [apiKey]);

  // Function to extract text from images using Tesseract.js
  const extractTextFromImage = async (imageFile) => {
    const worker = await createWorker();
    try {
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      const { data: { text } } = await worker.recognize(imageFile);
      return text;
    } finally {
      await worker.terminate();
    }
  };

  // Function to extract text from PDFs using pdfjs-dist
  const extractTextFromPDF = async (pdfFile) => {
    const arrayBuffer = await pdfFile.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let extractedText = '';

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const textContent = await page.getTextContent();
      extractedText += textContent.items.map((item) => item.str).join(' ');
    }

    return extractedText;
  };

  // Handle file upload and text extraction
  const handleFileChange = useCallback(async (e) => {
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setError(null);
    setIsProcessingFile(true);

    try {
      let extractedText = '';
      let previewContent = '';

      if (selectedFile.type === 'application/pdf') {
        extractedText = await extractTextFromPDF(selectedFile);
        previewContent = URL.createObjectURL(selectedFile);
      } else if (selectedFile.type.startsWith('image/')) {
        extractedText = await extractTextFromImage(selectedFile);
        previewContent = URL.createObjectURL(selectedFile);
      } else {
        setError('Unsupported file type');
        return;
      }

      setFile(selectedFile);
      setFilePreview({
        type: selectedFile.type,
        content: previewContent,
        extractedText,
        name: selectedFile.name,
      });
    } catch (error) {
      console.error('File processing error:', error);
      setError('Error processing file. Please try again.');
    } finally {
      setIsProcessingFile(false);
    }
  }, []);

  // Handle sending messages
  const handleSend = useCallback(async () => {
    if (!input.trim() && !filePreview?.extractedText) return;

    setIsLoading(true);

    // Combine text input with extracted file text
    const fullMessageContent = [
      input,
      filePreview?.extractedText ? `\n**File Content:**\n${filePreview.extractedText}` : '',
    ].filter(Boolean).join('\n');

    const newMessages = [
      ...messages,
      {
        role: 'user',
        content: fullMessageContent,
        file: filePreview?.content,
        fileName: filePreview?.name,
      },
    ];

    setMessages(newMessages);
    setInput('');
    setFile(null);
    setFilePreview(null);

    try {
      const response = await groq.chat.completions.create({
        messages: newMessages
          .filter((msg) => msg.role === 'user' || msg.role === 'assistant')
          .map((msg) => ({
            role: msg.role,
            content: msg.content || '',
          })),
        model: 'llama-3.3-70b-versatile',
      });

      const botMessage = response.choices[0]?.message?.content || 'No response received.';
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: 'assistant', content: botMessage },
      ]);
    } catch (error) {
      console.error('Groq API error:', error);
      setMessages((prevMessages) => [
        ...prevMessages,
        { role: 'assistant', content: 'Something went wrong. Please try again!' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [input, filePreview, messages, groq]);

  // Clear uploaded file
  const handleClearFile = useCallback(() => {
    setFile(null);
    setFilePreview(null);
    setError(null);
  }, []);

  // Handle Enter key press
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="chatbot-container">
      <h1 className="chatbot-title">AI Legal Assistant</h1>

      {error && <div className="error-message">{error}</div>}

      <div className="chatbot-messages">
        {messages.map((msg, index) => (
          <div key={index} className={`chatbot-message ${msg.role}`}>
            <ReactMarkdown>{msg.content}</ReactMarkdown>

            {msg.file && (
              <div className="file-preview">
                {msg.file.startsWith('blob:') ? (
                  <>
                    {msg.fileName?.endsWith('.pdf') ? (
                      <div className="pdf-preview">
                        <span>📄 PDF Document: {msg.fileName}</span>
                      </div>
                    ) : (
                      <img
                        src={msg.file}
                        alt="Uploaded content"
                        style={{ maxWidth: '100%', borderRadius: '5px' }}
                      />
                    )}
                    <div className="file-meta">
                      <small>Uploaded file: {msg.fileName}</small>
                    </div>
                  </>
                ) : (
                  <p>{msg.file}</p>
                )}
              </div>
            )}
          </div>
        ))}

        {isLoading && (
          <div className="chatbot-message assistant">
            <div className="typing-indicator">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
        )}
      </div>

      <div className="chatbot-input-container">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="chatbot-input"
          disabled={isLoading || isProcessingFile}
        />
        <button
          onClick={handleSend}
          className="chatbot-send-button"
          disabled={isLoading || isProcessingFile}
        >
          {isLoading ? 'Sending...' : 'Send'}
        </button>
      </div>

      <div className="file-upload-container">
        <label className="file-upload-label">
          {isProcessingFile ? 'Processing...' : 'Upload PDF/Image'}
          <input
            type="file"
            accept=".pdf,image/*"
            onChange={handleFileChange}
            className="file-upload-input"
            disabled={isLoading || isProcessingFile}
          />
        </label>

        {filePreview && (
          <div className="file-preview-container">
            <div className="file-preview">
              {filePreview.type === 'application/pdf' ? (
                <div className="pdf-preview">
                  <span>📄 {filePreview.name}</span>
                </div>
              ) : (
                <img
                  src={filePreview.content}
                  alt="Upload preview"
                  style={{ maxWidth: '100%', borderRadius: '5px' }}
                />
              )}
              {filePreview.extractedText && (
                <div className="extracted-text-preview">
                  <small>Extracted text:</small>
                  <p>{filePreview.extractedText.slice(0, 150)}...</p>
                </div>
              )}
            </div>
            <button onClick={handleClearFile} className="clear-file-button">
              Clear
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Chatbot;