import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private uploadEnabled: boolean;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET') || '';
    const missingEnv: string[] = [];
    if (!accessKeyId) missingEnv.push('AWS_ACCESS_KEY_ID');
    if (!secretAccessKey) missingEnv.push('AWS_SECRET_ACCESS_KEY');
    if (!this.bucketName) missingEnv.push('AWS_S3_BUCKET');
    this.uploadEnabled = missingEnv.length === 0;
    if (!this.uploadEnabled) {
      console.warn(
        `S3 upload disabled. Missing configuration: ${missingEnv.join(', ')}`,
      );
    }

    this.s3Client = new S3Client({
      region,
      ...(accessKeyId && secretAccessKey
        ? {
            credentials: {
              accessKeyId,
              secretAccessKey,
            },
          }
        : {}),
    });
  }

  async uploadFile(
    fileContent: Buffer | string,
    fileName: string,
    contentType: string = 'text/html',
  ): Promise<string> {
    try {
      if (!this.uploadEnabled) {
        throw new Error('S3 upload is disabled due to missing AWS configuration');
      }

      const key = `reports/${fileName}`;

      const uploadParams = {
        Bucket: this.bucketName,
        Key: key,
        Body: typeof fileContent === 'string' ? Buffer.from(fileContent) : fileContent,
        ContentType: contentType,
        ACL: 'public-read' as const,
      };

      const upload = new Upload({
        client: this.s3Client,
        params: uploadParams,
      });

      await upload.done();

      const fileUrl = `https://${this.bucketName}.s3.amazonaws.com/${key}`;
      return fileUrl;
    } catch (error: any) {
      console.error('Error uploading file to S3:', error);
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }
}
