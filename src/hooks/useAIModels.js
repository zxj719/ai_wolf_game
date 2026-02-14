import { useState, useEffect, useRef } from 'react';
import { AI_MODELS as DEFAULT_AI_MODELS, AI_PROVIDER, SILICONFLOW_FALLBACK_MODELS } from '../config/aiConfig';
import { fetchSiliconFlowChatModels } from '../services/aiClient';
import { logger } from '../utils/logger';

/**
 * useAIModels - 管理 AI 模型列表和禁用模型
 */
export function useAIModels() {
  const [aiModels, setAiModels] = useState(DEFAULT_AI_MODELS);
  const disabledModelsRef = useRef(new Set());

  useEffect(() => {
    const loadModels = async () => {
      if (AI_PROVIDER === 'siliconflow') {
        try {
          const models = await fetchSiliconFlowChatModels({ apiKey: null });
          if (models && models.length > 0) {
            setAiModels(models);
          } else {
            logger.debug('[AI模型] SiliconFlow 模型列表为空，使用备用列表');
            setAiModels(SILICONFLOW_FALLBACK_MODELS);
          }
        } catch (err) {
          logger.error('[AI模型] 加载模型列表失败:', err);
          setAiModels(SILICONFLOW_FALLBACK_MODELS);
        }
      }
    };
    loadModels();
  }, []);

  return { aiModels, disabledModelsRef };
}
