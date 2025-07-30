import { computed, createApp, inject, Plugin, ref } from 'vue'

import IconClose from '@/assets/icons/close.svg?component'
import Loading from '@/components/Loading.vue'
import Modal from '@/components/Modal.vue'
import Button from '@/components/ui/Button.vue'
import { PromiseOr } from '@/types/common'
import { useGlobalI18n } from '@/utils/i18n'

const CONFIRM_MODAL_ROOT_PROVIDER = Symbol('confirmModalRootElement')

export interface ConfirmModalOptions {
  message: string
  onConfirm?: () => PromiseOr<void>
  onCancel?: () => PromiseOr<void>
  confirmText?: string
  cancelText?: string
}

export const initConfirmModal: (rootEl: HTMLElement) => Plugin = (rootEl) => {
  const mountPoint = document.createElement('div')
  mountPoint.classList.add('nativemind-modal-mount-point')
  rootEl.appendChild(mountPoint)
  return {
    install(app) {
      const confirm = async ({ message, onConfirm, onCancel, confirmText, cancelText }: ConfirmModalOptions) => {
        const confirmLoading = ref(false)
        const cancelLoading = ref(false)
        const loading = computed(() => confirmLoading.value || cancelLoading.value)
        const close = () => tempApp.unmount()
        const i18n = await useGlobalI18n()
        const cancel = async () => {
          cancelLoading.value = true
          try {
            await onCancel?.()
          }
          finally {
            cancelLoading.value = false
          }
          close()
        }
        const confirm = async () => {
          confirmLoading.value = true
          try {
            await onConfirm?.()
          }
          finally {
            confirmLoading.value = false
          }
          close()
        }
        const tempApp = createApp(
          () => (
            <Modal modelValue closeByMask noCloseButton maskClass="bg-[#00000017]" onClose={cancel}>
              <div class="p-1">
                <div class="p-8 bg-white rounded-2xl flex flex-col gap-8 w-[520px] max-w-full shadow-[0px_2px_4px_0px_#0000000A,0px_1px_2px_-1px_#00000014,0px_0px_0px_1px_#00000014]">
                  <div class="absolute right-4 top-4" onClick={cancel}>
                    <IconClose class="text-[#9EA3A8] w-5 h-5" />
                  </div>
                  <div class="text-sm">
                    {message}
                  </div>
                  <div class="flex justify-end gap-2 flex-wrap">
                    <Button disabled={loading.value} variant="secondary" class="flex justify-center items-center min-h-8 min-w-36 max-w-full px-2 py-1 font-medium text-xs" onClick={cancel}>
                      {
                        cancelLoading.value
                          ? <Loading />
                          : (
                              <span>
                                {cancelText || i18n.t('common.cancel')}
                              </span>
                            )
                      }
                    </Button>
                    <Button disabled={loading.value} class="flex justify-center items-center min-h-8 min-w-36 max-w-full px-2 py-1 font-medium text-xs" onClick={confirm}>
                      {
                        confirmLoading.value
                          ? <Loading />
                          : (
                              <span>
                                {confirmText || i18n.t('common.confirm')}
                              </span>
                            )
                      }
                    </Button>
                  </div>
                </div>
              </div>
            </Modal>
          ),
        )
        tempApp.mount(mountPoint)
      }
      app.provide(CONFIRM_MODAL_ROOT_PROVIDER, confirm)
    },
  }
}

export const useConfirm = () => {
  const toast = inject<(options: ConfirmModalOptions) => void>(CONFIRM_MODAL_ROOT_PROVIDER)
  return toast!
}
