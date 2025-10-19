import json
from channels.generic.websocket import AsyncWebsocketConsumer


class DashboardConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time dashboard updates"""

    async def connect(self):
        self.group_name = 'dashboard_updates'

        # Join dashboard group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave dashboard group
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def dashboard_update(self, event):
        """Send dashboard update to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': event['type'],
            'data': event['data']
        }))


class TransactionConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for real-time transaction updates"""

    async def connect(self):
        self.group_name = 'transaction_updates'

        # Join transaction group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave transaction group
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def transaction_update(self, event):
        """Send transaction update to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'transaction',
            'data': event['data']
        }))


class MLTrainingConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for ML training updates"""

    async def connect(self):
        self.group_name = 'ml_training_updates'

        # Join ML training group
        await self.channel_layer.group_add(
            self.group_name,
            self.channel_name
        )

        await self.accept()

    async def disconnect(self, close_code):
        # Leave ML training group
        await self.channel_layer.group_discard(
            self.group_name,
            self.channel_name
        )

    async def training_update(self, event):
        """Send training update to WebSocket"""
        await self.send(text_data=json.dumps({
            'type': 'training_progress',
            'data': event['data']
        }))