import { test as base, expect, APIRequestContext } from '@playwright/test';
import * as dotenv from 'dotenv';

dotenv.config();

const TOKEN = process.env.AUTH_TOKEN || '';
export const MUTATION_ENABLED = String(process.env.RUN_MUTATION_TESTS || 'false').toLowerCase() === 'true';
// organizationId hop le, bat buoc ve nghiep vu khi tao/sua khao sat (xem testcases/Survey/02_post_surveys.yaml)
export const TEST_ORGANIZATION_ID = process.env.TEST_ORGANIZATION_ID || '';

if (!TOKEN) {
  // eslint-disable-next-line no-console
  console.warn('[WARN] AUTH_TOKEN chua duoc cau hinh trong .env - cac request se tra ve 401.');
}

type Fixtures = {
  authedRequest: APIRequestContext;
};

/**
 * Fixture "authedRequest": dung chung cho moi test case, tu dong gan header
 * Authorization: Bearer <token> lay tu bien moi truong AUTH_TOKEN (.env).
 */
export const test = base.extend<Fixtures>({
  authedRequest: async ({ playwright, baseURL }, use) => {
    const context = await playwright.request.newContext({
      baseURL,
      extraHTTPHeaders: {
        Accept: 'application/json',
        Authorization: TOKEN ? `Bearer ${TOKEN}` : '',
      },
    });
    await use(context);
    await context.dispose();
  },
});

export { expect };

/** Sinh chuoi hau to duy nhat de tranh trung du lieu giua cac lan chay test. */
export function uniqueSuffix(): string {
  return `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

/**
 * Lay mang du lieu tu response phan trang cua API thuc te, co dang:
 *   { data: { content: [...], page, size, totalElements, totalPages, numberOfElements }, code, message, isSuccess }
 * Ham nay cung chap nhan vai bien the khac (items/data truc tiep la mang) de phong khi API thay doi.
 */
export function getPagedItems(body: any): any[] {
  const d = body?.data ?? body;
  if (Array.isArray(d)) return d;
  return d?.content ?? d?.items ?? [];
}

/**
 * Xoa an toan 1 khao sat test da tao (dung trong afterEach). PHAT HIEN QUAN TRONG (2026-10-06):
 * server CHI cho phep DELETE khao sat dang o status=1 (Nhap) hoac status=4 (Bi tu choi)
 * ("Chỉ được xóa khảo sát ở trạng thái Nháp hoặc Bị từ chối"). Neu khao sat dang o status=2
 * (Cho phe duyet), ham nay tu dong tu choi (PUT .../status {status:4}) TRUOC khi xoa.
 *
 * CANH BAO: neu khao sat da o status=3 (Da phe duyet), 5 (Dang dien ra) hoac 6 (Da ket thuc),
 * KHONG CO API nao de dua no ve trang thai xoa duoc nua (da xac nhan qua thuc nghiem - PUT
 * /{id}/status va PUT /{id} deu tu choi voi moi gia tri). Trong truong hop nay ham se log canh
 * bao ro rang thay vi am tham nuot loi, de tranh de lai rac vinh vien ma khong ai biet - cac test
 * PHAI tranh approve mot khao sat test roi moi xoa; neu test can kiem tra luong approve, hay chap
 * nhan khao sat do se KHONG xoa duoc va ghi chu ro trong test.
 */
export async function safeDeleteSurvey(authedRequest: APIRequestContext, surveyId: string): Promise<void> {
  try {
    const getRes = await authedRequest.get(`/api/v1/survey/surveys/${surveyId}`);
    if (getRes.status() === 404) return; // da khong con ton tai, khong can lam gi them
    const survey = (await getRes.json())?.data;
    if (survey?.status === 2) {
      await authedRequest.put(`/api/v1/survey/surveys/${surveyId}/status`, { data: { status: 4 } }).catch(() => {});
    }
    const delRes = await authedRequest.delete(`/api/v1/survey/surveys/${surveyId}`);
    if (delRes.status() !== 200 && delRes.status() !== 404) {
      // eslint-disable-next-line no-console
      console.warn(
        `[CLEANUP WARNING] Khong the xoa khao sat test ${surveyId} (status hien tai=${survey?.status}, code=${survey?.code}). ` +
          `He thong chi cho xoa khi Nhap/Bi tu choi va KHONG co API chuyen ve trang thai do tu status nay. ` +
          `Can nguoi co quyen truy cap database xoa thu cong ban ghi nay.`
      );
    }
  } catch {
    // khong de loi don dep lam fail test chinh
  }
}
