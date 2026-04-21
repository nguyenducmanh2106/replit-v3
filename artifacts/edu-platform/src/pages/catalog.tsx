import { useState } from "react";
import { Link } from "@/lib/routing";
import { useListPublicCourses } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { BookOpen, Users, Search } from "lucide-react";

export default function CatalogPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | undefined>(undefined);
  const { data: courses, isLoading } = useListPublicCourses({ search: search || undefined, category });

  const categories = Array.from(new Set((courses ?? []).map((c) => c.category).filter(Boolean) as string[]));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/"><h1 className="text-xl font-bold text-primary">EduPlatform</h1></Link>
          <div className="flex gap-2">
            <Link href="/sign-in"><Button variant="outline">Đăng nhập</Button></Link>
            <Link href="/sign-up"><Button>Đăng ký</Button></Link>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Khám phá khóa học</h2>
          <p className="text-muted-foreground mt-1">Tìm khóa học phù hợp và bắt đầu học ngay hôm nay</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input placeholder="Tìm khóa học..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant={!category ? "default" : "outline"} onClick={() => setCategory(undefined)}>Tất cả</Button>
            {categories.map((c) => (
              <Button key={c} size="sm" variant={category === c ? "default" : "outline"} onClick={() => setCategory(c)}>{c}</Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-60" />)}
          </div>
        ) : courses && courses.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((c) => (
              <Link key={c.id} href={`/catalog/${c.slug || c.id}`}>
                <Card className="cursor-pointer hover:shadow-md hover:border-primary/40 transition-all h-full">
                  {c.coverImage && <img src={c.coverImage} alt={c.name} className="w-full h-36 object-cover rounded-t-md" />}
                  <CardHeader>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {c.level && <Badge variant="secondary" className="text-xs">{c.level}</Badge>}
                      {c.category && <Badge variant="outline" className="text-xs">{c.category}</Badge>}
                    </div>
                    <CardTitle className="text-lg line-clamp-2">{c.name}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {c.shortDescription && <p className="text-sm text-muted-foreground line-clamp-2">{c.shortDescription}</p>}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                      <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{c.totalLessons} bài</span>
                      <span className="flex items-center gap-1"><Users className="w-3 h-3" />{c.studentCount} học viên</span>
                    </div>
                    {c.teacherName && <p className="text-xs text-muted-foreground">Giảng viên: {c.teacherName}</p>}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card><CardContent className="text-center py-16">
            <BookOpen className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-50" />
            <p className="text-muted-foreground">Chưa có khóa học công khai nào.</p>
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}
