import { X, Share2 } from 'lucide-react';

export function ResultModal({ open, kind, lang, asset, headline, message, pnlLabel, onClose }) {
    if (!open) return null;
    const isWin = kind === 'WIN';

    async function compartilhar() {
        const canvas = document.createElement('canvas');
        canvas.width = 1080; canvas.height = 1080;
        const ctx = canvas.getContext('2d');
        const grad = ctx.createRadialGradient(540, 210, 20, 540, 280, 640);
        grad.addColorStop(0, 'rgba(16,185,129,0.38)');
        grad.addColorStop(1, 'rgba(16,185,129,0)');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, 1080, 1080);
        ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(52,211,153,0.85)';
        ctx.strokeRect(36, 36, 1008, 1008);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#6ee7b7'; ctx.font = '700 26px Arial';
        ctx.fillText('WIN', 540, 118);
        ctx.fillStyle = '#ffffff'; ctx.font = '900 68px Arial';
        ctx.fillText(headline, 540, 200);
        if (pnlLabel) {
            ctx.fillStyle = '#6ee7b7'; ctx.font = '900 72px Arial';
            ctx.fillText(pnlLabel, 540, 300);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.font = '600 32px Arial';
        ctx.fillText(message, 540, 400);

        const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
        const file = new File([blob], lang === 'es' ? 'salio-green.png' : 'deu-green.png', { type: 'image/png' });

        if (navigator.share && navigator.canShare({ files: [file] })) {
            await navigator.share({ files: [file], title: headline });
        } else {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url; a.download = 'resultado.png'; a.click();
            URL.revokeObjectURL(url);
        }
    }

    return (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
            <div
                className={`relative z-10 w-full max-w-md space-y-4 rounded-2xl border p-6 ${isWin ? 'border-green-500/60' : 'border-red-500/45'}`}
                style={{
                    background: isWin ? 'radial-gradient(120% 80% at 50% 0%, rgba(16,185,129,0.22), var(--bg-card) 58%)' : 'var(--bg-card)',
                    boxShadow: isWin ? '0 0 60px rgba(16,185,129,0.28)' : undefined
                }}
                onClick={e => e.stopPropagation()}
            >
                <button onClick={onClose} className="absolute right-3 top-3 rounded-full p-1.5 text-white/60 hover:text-white">
                    <X className="h-5 w-5" />
                </button>

                {isWin ? (
                    <div className="flex flex-col items-center text-center">
                        <div className="mb-3 text-6xl">🏆</div>
                        <p className="text-xs font-bold uppercase tracking-[0.42em] text-emerald-300">WIN</p>
                        <p className="mt-2 text-3xl font-black text-white">{headline}</p>
                        {pnlLabel && <p className="mt-4 text-5xl font-black text-emerald-300">{pnlLabel}</p>}
                        <p className="mt-4 max-w-md text-lg font-medium text-white/90">{message}</p>
                        <button onClick={compartilhar} className="mt-7 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-400 py-4 text-base font-bold text-black">
                            <Share2 className="h-5 w-5" />
                            {lang === 'es' ? 'Compartir' : 'Compartilhar'}
                        </button>
                    </div>
                ) : (
                    <div>
                        <p className="text-4xl font-extrabold text-red-400">LOSS</p>
                        <p className="mt-2 text-base text-white/70">{message}</p>
                        <button onClick={onClose} className="mt-4 w-full rounded-xl border border-white/20 py-3 text-sm font-semibold text-white/70">
                            {lang === 'es' ? 'Cerrar' : 'Fechar'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}