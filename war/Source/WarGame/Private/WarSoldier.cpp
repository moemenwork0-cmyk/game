#include "WarSoldier.h"
#include "WarAnimInstance.h"
#include "Animation/AnimSequence.h"
#include "Components/SkeletalMeshComponent.h"
#include "NavigationPath.h"
#include "NavigationSystem.h"

AWarSoldier::AWarSoldier()
{
	PrimaryActorTick.bCanEverTick = true;
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	Mesh = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("Mesh"));
	Mesh->SetupAttachment(RootComponent);
	Mesh->SetAnimationMode(EAnimationMode::AnimationBlueprint);
	Mesh->SetAnimInstanceClass(UWarAnimInstance::StaticClass());
	Mesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Mesh->VisibilityBasedAnimTickOption = EVisibilityBasedAnimTickOption::AlwaysTickPoseAndRefreshBones;
}

UWarAnimInstance* AWarSoldier::Anim() const
{
	return Cast<UWarAnimInstance>(Mesh->GetAnimInstance());
}

void AWarSoldier::Play(FName Clip, bool bLoop, float Rate, float Blend)
{
	UAnimSequence* Seq = Clips.FindRef(Clip);
	if (!Seq)
	{
		UE_LOG(LogTemp, Warning, TEXT("Soldier: missing clip %s"), *Clip.ToString());
		return;
	}
	if (UWarAnimInstance* A = Anim())
	{
		A->Play(Seq, bLoop, Rate, Blend);
	}
}

float AWarSoldier::ClipLength(FName Clip, float Rate) const
{
	const UAnimSequence* Seq = Clips.FindRef(Clip);
	return Seq ? Seq->GetPlayLength() / FMath::Max(Rate, 0.01f) : 1.f;
}

void AWarSoldier::MoveTo(const FVector& Target, float InSpeed, FName Clip, float Rate, TFunction<void()> Done, bool bStopClip)
{
	Path.Reset();
	const FVector Start(GetActorLocation().X, GetActorLocation().Y, GroundZ);
	const FVector End(Target.X, Target.Y, GroundZ);
	if (UNavigationPath* Nav = UNavigationSystemV1::FindPathToLocationSynchronously(this, Start, End))
	{
		for (int32 i = 1; i < Nav->PathPoints.Num(); ++i)
		{
			Path.Add(Nav->PathPoints[i]);
		}
	}
	if (Path.Num() == 0)
	{
		Path.Add(End);  // no nav data: straight line
	}
	Path.Last() = End;
	Speed = InSpeed;
	MoveClip = Clip;
	MoveRate = Rate;
	bUseStop = bStopClip && Clip == "Walking";
	OnArrived = MoveTemp(Done);
	bFacePoint = false;

	// A hard bend before setting off: turn on the spot with the turn clip first.
	const float Want = (Path[0] - Start).Rotation().Yaw;
	const float Delta = FRotator::NormalizeAxis(Want - GetActorRotation().Yaw);
	if (FMath::Abs(Delta) > 60.f && Speed < 400.f && Clips.Contains("Left_Turn"))
	{
		const FName TurnClip = Delta > 0.f ? FName("Right_Turn") : FName("Left_Turn");
		Play(TurnClip, false, 1.3f, 0.2f);
		TurnLeft = ClipLength(TurnClip, 1.3f) * 0.85f;
		TurnYaw = Delta;
		bMoving = true;
		return;
	}
	bMoving = true;
	Play(MoveClip, true, MoveRate, 0.3f);
}

void AWarSoldier::NextLeg()
{
	Path.RemoveAt(0);
	if (Path.Num() > 0)
	{
		return;
	}
	bMoving = false;
	if (bUseStop && Clips.Contains("Walk_Stop"))
	{
		Play("Walk_Stop", false, 1.f, 0.2f);
	}
	if (OnArrived)
	{
		TFunction<void()> Done = MoveTemp(OnArrived);
		Done();
	}
}

void AWarSoldier::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	FVector Loc = GetActorLocation();
	if (TurnLeft > 0.f)
	{
		// The clip itself rotates the body; the actor follows smoothly so the end pose lines up.
		const float Step = FMath::Min(DeltaSeconds, TurnLeft);
		AddActorWorldRotation(FRotator(0.f, TurnYaw * Step / FMath::Max(TurnLeft, 0.01f), 0.f));
		TurnYaw -= TurnYaw * Step / FMath::Max(TurnLeft, 0.01f);
		TurnLeft -= Step;
		if (TurnLeft <= 0.f && bMoving)
		{
			Play(MoveClip, true, MoveRate, 0.35f);
		}
		return;
	}
	if (bMoving && Path.Num() > 0)
	{
		const FVector Goal(Path[0].X, Path[0].Y, GroundZ);
		const FVector To = Goal - FVector(Loc.X, Loc.Y, GroundZ);
		const float Dist = To.Size2D();
		const float StepLen = Speed * DeltaSeconds;
		if (Dist <= StepLen)
		{
			SetActorLocation(FVector(Goal.X, Goal.Y, GroundZ + Sink));
			NextLeg();
		}
		else
		{
			SetActorLocation(FVector(Loc.X, Loc.Y, GroundZ + Sink) + To / Dist * StepLen);
			const FRotator Want(0.f, To.Rotation().Yaw, 0.f);
			SetActorRotation(FMath::RInterpTo(GetActorRotation(), Want, DeltaSeconds, 6.f));
		}
	}
	else if (bFacePoint)
	{
		const FRotator Want(0.f, (FacePoint - Loc).Rotation().Yaw, 0.f);
		SetActorRotation(FMath::RInterpTo(GetActorRotation(), Want, DeltaSeconds, 3.f));
	}
	if (!bMoving)
	{
		SetActorLocation(FVector(GetActorLocation().X, GetActorLocation().Y, GroundZ + Sink));
	}
}

void AWarSoldier::SettleOnHips()
{
	for (const TCHAR* Bone : { TEXT("mixamorig:Hips"), TEXT("mixamorig_Hips"), TEXT("Hips") })
	{
		if (Mesh->GetBoneIndex(Bone) != INDEX_NONE)
		{
			const FVector Hips = Mesh->GetBoneLocation(Bone);
			SetActorLocation(FVector(Hips.X, Hips.Y, GetActorLocation().Z));
			return;
		}
	}
}
