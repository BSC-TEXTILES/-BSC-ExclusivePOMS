import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import { AuthProvider, CartProvider } from './auth.jsx';
import { TrackingProvider } from './tracking.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import BackendHealthCheck from './components/BackendHealthCheck.jsx';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <BackendHealthCheck>
          <AuthProvider>
            <CartProvider>
              <TrackingProvider>
                <App />
              </TrackingProvider>
            </CartProvider>
          </AuthProvider>
        </BackendHealthCheck>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>
);
