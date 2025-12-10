import React from 'react';

const Loader = () => {
  return (
    <div className="flex items-center justify-center">
      <style>{`
        .spinner .path {
          animation: infinity-load 1.5s infinite cubic-bezier(.65,.05,.36,1);
        }
        @keyframes infinity-load {
          to {
            stroke-dashoffset: 10;
          }
        }
      `}</style>
      <div className="spinner">
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" width={150} height={150} fill="none">
          <path 
            stroke="#0ea5e9" 
            strokeWidth="1.0" 
            d="M9.743 10.25c3.213 1.96 5.017 4.676 7.248 4.676 2.588 0 2.791-4.8.518-5.668-3.107-1.187-5.178 3.719-8.284 5.03-1.415.677-3.41 1.014-4.09-1.14-.251-.797-.13-1.65.133-2.442v0c.425-1.278 2.132-1.66 3.35-1.081.304.144.668.346 1.125.625z" 
            strokeDashoffset={100} 
            strokeDasharray={100} 
            className="path"
          />
        </svg>
      </div>
    </div>
  );
};

export default Loader;