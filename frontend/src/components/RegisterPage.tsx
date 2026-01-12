import React, { useState } from 'react';
import { api } from '../api';

export function RegisterPage({ onRegistered, onCancel }: { onRegistered: () => void; onCancel: () => void }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [role, setRole] = useState('consultant');
    const [error, setError] = useState('');

    async function doRegister(e: React.FormEvent) {
        e.preventDefault();
        try {
            await api.register({ email, password, full_name: fullName, role });
            alert('Registration successful! Please login.');
            onRegistered();
        } catch (err: any) {
            setError(err.message || 'Registration failed');
        }
    }

    return (
        <div className="card" style={{ maxWidth: 400, margin: '50px auto' }}>
            <div className="cardTitle">Register</div>
            <form onSubmit={doRegister}>
                <div className="field">
                    <label className="label">Email</label>
                    <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
                </div>
                <div className="field">
                    <label className="label">Password</label>
                    <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
                </div>
                <div className="field">
                    <label className="label">Full Name</label>
                    <input className="input" value={fullName} onChange={e => setFullName(e.target.value)} required />
                </div>
                <div className="field">
                    <label className="label">Role</label>
                    <select className="select" value={role} onChange={e => setRole(e.target.value)}>
                        <option value="consultant">Consultant</option>
                        <option value="admin">Admin</option>
                        <option value="client">ClientViewer</option>
                    </select>
                </div>
                {error && <div style={{ color: 'red', marginBottom: 10 }}>{error}</div>}
                <button className="btn primary" type="submit">Register</button>
            </form>
            <div style={{ marginTop: 20, textAlign: 'center' }}>
                <button className="btn" onClick={onCancel}>Back to Login</button>
            </div>
        </div>
    );
}
