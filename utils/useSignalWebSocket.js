import { useCallback, useEffect, useRef, useState } from 'react';

export function useSignalWebSocket(userId, onSignal, onResult) {
    const ws = useRef(null);
    const [connected, setConnected] = useState(false);

    useEffect(() => {
        if (!userId) return;
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const socket = new WebSocket(`${protocol}//${window.location.host}/ws`);
        ws.current = socket;

        socket.onopen = () => {
            setConnected(true);
            socket.send(JSON.stringify({ type: 'set_user_id', user_id: userId }));
        };

        socket.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                switch (data.type) {
                    case 'best_asset_found':
                    case 'analysis_result':
                        onSignal?.(data.data); break;
                    case 'signal_result':
                    case 'auto_entry_status':
                        onResult?.(data.data); break;
                }
            } catch {}
        };

        socket.onclose = () => setConnected(false);
        return () => socket.close();
    }, [userId, onSignal, onResult]);

    const agendarEntrada = useCallback((sinal) => {
        if (ws.current?.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({
                type: 'schedule_auto_entry',
                data: {
                    ativo: sinal.ativo,
                    direcao: sinal.direcao,
                    timeframe: sinal.timeframe,
                    horario_entrada: sinal.horario_entrada,
                    signal_id: sinal.signal_id,
                    broker: sinal.broker
                }
            }));
        }
    }, []);

    return { connected, agendarEntrada };
}