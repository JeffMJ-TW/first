
import React from 'react';
import { StampInfo } from './types';

export const MAX_STAMPS = 10;

export const STAMP_OPTIONS: StampInfo[] = [
  { id: 'cat', emoji: '🐱', color: 'bg-orange-100', label: 'Kitty' },
  { id: 'bear', emoji: '🐻', color: 'bg-amber-100', label: 'Bear' },
  { id: 'rabbit', emoji: '🐰', color: 'bg-pink-100', label: 'Bunny' },
  { id: 'panda', emoji: '🐼', color: 'bg-gray-100', label: 'Panda' },
  { id: 'frog', emoji: '🐸', color: 'bg-green-100', label: 'Froggy' },
  { id: 'chick', emoji: '🐤', color: 'bg-yellow-100', label: 'Chick' },
];

export const PROFILE_CONFIG = {
  A: {
    name: 'Brownie',
    theme: 'amber',
    avatar: 'https://picsum.photos/id/237/200/200',
    primaryColor: 'text-amber-600',
    bgColor: 'bg-amber-50',
    accentColor: 'bg-amber-500',
  },
  B: {
    name: 'Snowy',
    theme: 'sky',
    avatar: 'https://picsum.photos/id/1025/200/200',
    primaryColor: 'text-sky-600',
    bgColor: 'bg-sky-50',
    accentColor: 'bg-sky-500',
  }
};
