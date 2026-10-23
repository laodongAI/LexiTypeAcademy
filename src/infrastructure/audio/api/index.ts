/**
 * HTTP API TTS/ASR 模块导出
 */

// 类型导出
export type {
  HealthResponse,
  ModelsResponse,
  TTSSpeaker,
  TTSVoicesResponse,
  TTSSynthesizeRequest,
  TTSSwitchModelResponse,
  TTSAsyncResponse,
  ASRRecognizeResponse,
  ASRVadRecognizeResponse,
  ASRSwitchModelResponse,
  ASRCapabilitiesResponse,
  ASRAsyncResponse,
  TaskStatus,
  TaskType,
  TaskResponse,
  TaskListResponse,
  DefaultSettingsResponse,
  ApiErrorResponse,
} from './types';

// 客户端导出
export {
  AudioApiClient,
  ApiError,
  getAudioApiClient,
  resetAudioApiClient,
  type ApiClientConfig,
} from './AudioApiClient';
