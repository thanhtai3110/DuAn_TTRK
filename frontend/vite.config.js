import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
const target = 'http://127.0.0.1:' + (Number(process.env.PORT) || 3001);
export default defineConfig({plugins:[react()],server:{port:5173,strictPort:true,proxy:{'/api':{target,changeOrigin:false}}},preview:{proxy:{'/api':{target,changeOrigin:false}}}});
