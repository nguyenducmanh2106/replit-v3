import { Link } from "@/lib/routing";
import { useListMyCertificates } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Award } from "lucide-react";
import { format, parseISO } from "date-fns";

export default function CertificatesPage() {
  const { data: certs, isLoading } = useListMyCertificates();

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Chứng chỉ của tôi</h1>
        <p className="text-muted-foreground mt-1">Chứng chỉ được cấp tự động khi bạn hoàn thành 100% khóa học</p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}
        </div>
      ) : certs && certs.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {certs.map((c) => (
            <Link key={c.id} href={`/certificates/${c.certificateNo}`}>
              <Card className="cursor-pointer hover:shadow-md hover:border-primary/40 h-full">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <Award className="w-6 h-6 text-yellow-600" />
                    <CardTitle className="text-base">{c.courseName}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-1">
                  <p>Số chứng chỉ: <strong className="text-foreground">{c.certificateNo}</strong></p>
                  <p>Cấp ngày: {format(parseISO(c.issuedAt), "dd/MM/yyyy")}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card><CardContent className="text-center py-16">
          <Award className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Bạn chưa có chứng chỉ nào.</p>
          <p className="text-xs text-muted-foreground mt-1">Hoàn thành 100% một khóa học để nhận chứng chỉ.</p>
        </CardContent></Card>
      )}
    </div>
  );
}
