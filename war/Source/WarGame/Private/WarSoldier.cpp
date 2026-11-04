#include "WarSoldier.h"
#include "Animation/AnimSequence.h"
#include "Components/SkeletalMeshComponent.h"

AWarSoldier::AWarSoldier()
{
	PrimaryActorTick.bCanEverTick = true;
	RootComponent = CreateDefaultSubobject<USceneComponent>(TEXT("Root"));
	Mesh = CreateDefaultSubobject<USkeletalMeshComponent>(TEXT("Mesh"));
	Mesh->SetupAttachment(RootComponent);
	Mesh->SetAnimationMode(EAnimationMode::AnimationSingleNode);
	Mesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);
	Mesh->VisibilityBasedAnimTickOption = EVisibilityBasedAnimTickOption::AlwaysTickPoseAndRefreshBones;
}

void AWarSoldier::Play(FName Clip, bool bLoop, float Rate)
{
	if (const TObjectPtr<UAnimSequence>* Anim = Clips.Find(Clip))
	{
		Mesh->PlayAnimation(*Anim, bLoop);
		Mesh->SetPlayRate(Rate);
	}
	else
	{
		UE_LOG(LogTemp, Warning, TEXT("Soldier: missing clip %s"), *Clip.ToString());
	}
}

float AWarSoldier::ClipLength(FName Clip, float Rate) const
{
	const TObjectPtr<UAnimSequence>* Anim = Clips.Find(Clip);
	return Anim && *Anim ? (*Anim)->GetPlayLength() / FMath::Max(Rate, 0.01f) : 1.f;
}

void AWarSoldier::MoveTo(const FVector& InTarget, float InSpeed, FName Clip, float Rate, TFunction<void()> Done)
{
	Target = FVector(InTarget.X, InTarget.Y, GetActorLocation().Z);
	Speed = InSpeed;
	bMoving = true;
	bFacePoint = false;
	OnArrived = MoveTemp(Done);
	Play(Clip, true, Rate);
}

void AWarSoldier::Tick(float DeltaSeconds)
{
	Super::Tick(DeltaSeconds);

	FVector Loc = GetActorLocation();
	if (bMoving)
	{
		const FVector To = Target - Loc;
		const float Dist = To.Size2D();
		const float Step = Speed * DeltaSeconds;
		if (Dist <= Step)
		{
			SetActorLocation(Target);
			bMoving = false;
			if (OnArrived)
			{
				TFunction<void()> Done = MoveTemp(OnArrived);
				Done();
			}
		}
		else
		{
			SetActorLocation(Loc + To / Dist * Step);
			const FRotator Want(0.f, To.Rotation().Yaw, 0.f);
			SetActorRotation(FMath::RInterpTo(GetActorRotation(), Want, DeltaSeconds, 8.f));
		}
	}
	else if (bFacePoint)
	{
		const FRotator Want(0.f, (FacePoint - Loc).Rotation().Yaw, 0.f);
		SetActorRotation(FMath::RInterpTo(GetActorRotation(), Want, DeltaSeconds, 4.f));
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
