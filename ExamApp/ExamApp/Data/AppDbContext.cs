using ExamApp.Models;
using Microsoft.EntityFrameworkCore;
using System;
using System.IO;

namespace ExamApp.Data
{
    public class AppDbContext : DbContext
    {
        public DbSet<Topic> Topics { get; set; }
        public DbSet<Question> Questions { get; set; }
        public DbSet<AnswerOption> AnswerOptions { get; set; }
        public DbSet<QuestionImage> QuestionImages { get; set; }
        public DbSet<Exam> Exams { get; set; }
        public DbSet<ExamQuestion> ExamQuestions { get; set; }
        public DbSet<Participant> Participants { get; set; }
        public DbSet<ExamSession> ExamSessions { get; set; }
        public DbSet<ParticipantResult> ParticipantResults { get; set; }
        public DbSet<ParticipantAnswer> ParticipantAnswers { get; set; }

        protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
        {
            var dbPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "examapp.db");
            optionsBuilder.UseSqlite($"Data Source={dbPath}");
        }

        /// <summary>
        /// Дополняет уже существующую базу новыми столбцами/таблицами.
        /// EnsureCreated() создаёт схему только для НОВОЙ базы и не меняет старую,
        /// поэтому новые поля (формулы, картинки) добавляем здесь вручную и идемпотентно.
        /// </summary>
        public void EnsureSchemaUpToDate()
        {
            AddColumnIfMissing("Questions", "Formula", "TEXT");
            AddColumnIfMissing("AnswerOptions", "Formula", "TEXT");
            AddColumnIfMissing("AnswerOptions", "ImageData", "BLOB");

            Database.ExecuteSqlRaw(@"CREATE TABLE IF NOT EXISTS ""QuestionImages"" (
                ""Id"" INTEGER NOT NULL CONSTRAINT ""PK_QuestionImages"" PRIMARY KEY AUTOINCREMENT,
                ""QuestionId"" INTEGER NOT NULL,
                ""ImageData"" BLOB,
                ""Caption"" TEXT NULL,
                ""Order"" INTEGER NOT NULL,
                CONSTRAINT ""FK_QuestionImages_Questions_QuestionId"" FOREIGN KEY (""QuestionId"")
                    REFERENCES ""Questions"" (""Id"") ON DELETE CASCADE
            )");
        }

        private void AddColumnIfMissing(string table, string column, string sqlType)
        {
            using var conn = Database.GetDbConnection();
            conn.Open();
            bool exists = false;
            using (var check = conn.CreateCommand())
            {
                check.CommandText = $"PRAGMA table_info(\"{table}\")";
                using var reader = check.ExecuteReader();
                while (reader.Read())
                {
                    // column 1 of PRAGMA table_info is the column name
                    if (string.Equals(reader.GetString(1), column, StringComparison.OrdinalIgnoreCase))
                    {
                        exists = true;
                        break;
                    }
                }
            }
            if (!exists)
            {
                using var alter = conn.CreateCommand();
                alter.CommandText = $"ALTER TABLE \"{table}\" ADD COLUMN \"{column}\" {sqlType}";
                alter.ExecuteNonQuery();
            }
        }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            modelBuilder.Entity<Topic>(entity =>
            {
                entity.HasKey(t => t.Id);
                entity.Property(t => t.Name).IsRequired().HasMaxLength(200);
            });

            modelBuilder.Entity<Question>(entity =>
            {
                entity.HasKey(q => q.Id);
                entity.Property(q => q.Text).IsRequired();
                entity.Property(q => q.Type).IsRequired();
                entity.Property(q => q.MaxScore).IsRequired();
                entity.HasOne(q => q.Topic)
                      .WithMany(t => t.Questions)
                      .HasForeignKey(q => q.TopicId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<AnswerOption>(entity =>
            {
                entity.HasKey(a => a.Id);
                entity.Property(a => a.Text).IsRequired();
                entity.HasOne(a => a.Question)
                      .WithMany(q => q.AnswerOptions)
                      .HasForeignKey(a => a.QuestionId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<QuestionImage>(entity =>
            {
                entity.HasKey(i => i.Id);
                entity.HasOne(i => i.Question)
                      .WithMany(q => q.Images)
                      .HasForeignKey(i => i.QuestionId)
                      .OnDelete(DeleteBehavior.Cascade);
            });

            modelBuilder.Entity<Exam>(entity =>
            {
                entity.HasKey(e => e.Id);
                entity.Property(e => e.Title).IsRequired().HasMaxLength(300);
            });

            modelBuilder.Entity<ExamQuestion>(entity =>
            {
                entity.HasKey(eq => eq.Id);
                entity.HasOne(eq => eq.Exam)
                      .WithMany(e => e.ExamQuestions)
                      .HasForeignKey(eq => eq.ExamId)
                      .OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(eq => eq.Question)
                      .WithMany(q => q.ExamQuestions)
                      .HasForeignKey(eq => eq.QuestionId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<Participant>(entity =>
            {
                entity.HasKey(p => p.Id);
                entity.Property(p => p.LastName).IsRequired().HasMaxLength(100);
                entity.Property(p => p.FirstName).IsRequired().HasMaxLength(100);
                entity.Ignore(p => p.FullName);
            });

            modelBuilder.Entity<ExamSession>(entity =>
            {
                entity.HasKey(s => s.Id);
                entity.HasOne(s => s.Exam)
                      .WithMany(e => e.Sessions)
                      .HasForeignKey(s => s.ExamId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<ParticipantResult>(entity =>
            {
                entity.HasKey(r => r.Id);
                entity.HasOne(r => r.Session)
                      .WithMany(s => s.ParticipantResults)
                      .HasForeignKey(r => r.SessionId)
                      .OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(r => r.Participant)
                      .WithMany(p => p.Results)
                      .HasForeignKey(r => r.ParticipantId)
                      .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<ParticipantAnswer>(entity =>
            {
                entity.HasKey(a => a.Id);
                entity.HasOne(a => a.ParticipantResult)
                      .WithMany(r => r.Answers)
                      .HasForeignKey(a => a.ParticipantResultId)
                      .OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(a => a.Question)
                      .WithMany()
                      .HasForeignKey(a => a.QuestionId)
                      .OnDelete(DeleteBehavior.Restrict);
            });
        }
    }
}
