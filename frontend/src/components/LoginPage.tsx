import React, { useState } from 'react';
import { api } from '../api';

export function LoginPage({ onLogin, onGoRegister }: { onLogin: () => void; onGoRegister: () => void }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    async function doLogin(e: React.FormEvent) {
        e.preventDefault();
        try {
            const res = await api.login({ username: email, password });
            localStorage.setItem('token', res.access_token);
            onLogin();
        } catch (err: any) {
            setError(err.message || 'Login failed');
        }
    }

    return (
        <div className="card" style={{ maxWidth: 400, margin: '50px auto' }}>
            <div className="cardTitle">Login</div>
            <form onSubmit={doLogin}>
                <div className="field">
                    <label className="label">Email</label>
                    <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="field">
                    <label className="label">Password</label>
                    <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                {error && <div style={{ color: 'red', marginBottom: 10 }}>{error}</div>}
                <button className="btn primary" type="submit">Login</button>
            </form>
            <div style={{ marginTop: 20, textAlign: 'center' }}>
                <button className="btn" onClick={onGoRegister}>Create Account</button>
            </div>
        </div>
    );
}
