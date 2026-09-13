import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider, CartProvider } from './auth.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import BackendHealthCheck from './components/BackendHealthCheck.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <BackendHealthCheck>
            <CartProvider>
              <App />
            </CartProvider>
          </BackendHealthCheck>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
