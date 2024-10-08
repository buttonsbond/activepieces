import {
    ActivepiecesError,
    apId,
    ErrorCode,
    isNil,
    StepFile,
    StepFileGet,
    StepFileUpsert,
    StepFileWithUrl,
} from '@activepieces/shared'
import { repoFactory } from '../../core/db/repo-factory'
import { domainHelper } from '../../helper/domain-helper'
import { jwtUtils } from '../../helper/jwt-utils'
import { StepFileEntity } from './step-file.entity'

const stepFileRepo = repoFactory<StepFile>(StepFileEntity)

type FileToken = {
    fileId: string
}

export const stepFileService = {
    async upsert({
        hostname,
        request,
        projectId,
    }: {
        hostname: string
        request: StepFileUpsert
        projectId: string
    }): Promise<StepFile | null> {
        const fileId = apId()
        const bufferFile = request.file as Buffer
        const savedFile = await stepFileRepo().save({
            id: fileId,
            flowId: request.flowId,
            projectId,
            stepName: request.stepName,
            size: bufferFile.byteLength,
            name: request.name,
            data: bufferFile,
        })
        return encrichWithUrl(
            hostname,
            savedFile,
        )
    },
    async getByToken(token: string): Promise<StepFile | null> {
        try {
            const decodedToken = await jwtUtils.decodeAndVerify<FileToken>({
                jwt: token,
                key: await jwtUtils.getJwtSecret(),
            })
            const file = await stepFileRepo().findOneByOrFail({
                id: decodedToken.fileId,
            })
            return file
        }
        catch (e) {
            throw new ActivepiecesError({
                code: ErrorCode.INVALID_BEARER_TOKEN,
                params: {
                    message: 'invalid token or expired for the step file',
                },
            })
        }
    },
    async get({ projectId, id }: StepFileGet): Promise<StepFile | null> {
        const file = stepFileRepo().findOneBy({
            id,
            projectId,
        })
        if (isNil(file)) {
            throw new ActivepiecesError({
                code: ErrorCode.ENTITY_NOT_FOUND,
                params: {
                    message: `Step file with id ${id} not found`,
                },
            })
        }
        return file
    },
    async delete({ projectId, id }: StepFileGet): Promise<void> {
        const file = stepFileRepo().findOneBy({
            id,
            projectId,
        })
        if (isNil(file)) {
            throw new ActivepiecesError({
                code: ErrorCode.ENTITY_NOT_FOUND,
                params: {
                    message: `Step file with id ${id} not found`,
                },
            })
        }
        await stepFileRepo().delete({
            id,
            projectId,
        })
    },
    async deleteAll({
        projectId,
        flowId,
        stepName,
    }: {
        projectId: string
        flowId: string
        stepName: string
    }): Promise<void> {
        await stepFileRepo().delete({
            projectId,
            flowId,
            stepName,
        })
    },
}

async function encrichWithUrl(
    hostname: string,
    file: StepFile,
): Promise<StepFileWithUrl> {
    const jwtSecret = await jwtUtils.getJwtSecret()
    const accessToken = await jwtUtils.sign({
        payload: {
            fileId: file.id,
        },
        expiresInSeconds: 60 * 60 * 24 * 7,
        key: jwtSecret,
    })
    const url = await domainHelper.get().constructApiUrlFromRequest({
        domain: hostname,
        path: `v1/step-files/signed?token=${accessToken}`,
    })
    return {
        ...file,
        url,
    }
}
