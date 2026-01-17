import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';

@Injectable()
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private configService: ConfigService) {
    const region = this.configService.get<string>('AWS_REGION', 'us-east-1');
    const accessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const secretAccessKey = this.configService.get<string>(
      'AWS_SECRET_ACCESS_KEY',
    );
    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME');

    if (!accessKeyId || !secretAccessKey || !this.bucketName) {
      console.warn(
        'AWS credentials or bucket name not configured. S3 upload will fail.',
      );
    }

    this.s3Client = new S3Client({
      region,
      credentials: {
        accessKeyId: accessKeyId || '',
        secretAccessKey: secretAccessKey || '',
      },
    });
  }

  async uploadFile(
    fileContent: Buffer | string,
    fileName: string,
    contentType: string = 'text/html',
  ): Promise<string> {
    try {
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
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }
}
