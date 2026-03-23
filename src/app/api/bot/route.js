import bot from '@/lib/bot';
import { NextResponse } from 'next/server';

export async function GET() {
    return NextResponse.json(bot.getStatus());
}

export async function POST(request) {
    const { action } = await request.json();

    if (action === 'start') {
        if (!bot.getStatus().isRunning) {
            bot.start(); // No lo esperamos (corre en background)
            return NextResponse.json({ message: 'Bot iniciando...' });
        }
        return NextResponse.json({ message: 'El bot ya está corriendo.' });
    }

    if (action === 'stop') {
        bot.stop();
        return NextResponse.json({ message: 'Deteniendo bot...' });
    }

    return NextResponse.json({ error: 'Acción no válida' }, { status: 400 });
}
